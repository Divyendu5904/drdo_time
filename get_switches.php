<?php
// It's a good practice to log errors instead of displaying them to the user.
ini_set('log_errors', 1);
ini_set('display_errors', 0);
// Ensure errors are being logged to a file. You might need to configure this path.
ini_set('error_log', '/path/to/your/php-error.log'); 

session_start();
header('Content-Type: application/json');

// ✅ User Authentication
if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
    http_response_code(401);
    // Log the authentication failure for security auditing.
    error_log('Authentication failure: User not logged in.');
    echo json_encode(['success' => false, 'message' => 'User not authenticated.']);
    exit;
}

// ✅ Ping Function (remains the same)
function get_ping_result($ip_address, $timeout = 1) {
    $latency = null;
    $exit_code = 1; 
    $output = [];

    if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
        $command = "ping -n 1 -w " . ($timeout * 1000) . " " . escapeshellarg($ip_address);
        exec($command, $output, $exit_code);
        if ($exit_code === 0) {
            foreach ($output as $line) {
                if (strpos($line, 'time=') !== false || strpos($line, 'Time=') !== false) {
                    preg_match('/time(?:=|<)(\d+)/', $line, $matches);
                    $latency = isset($matches[1]) ? (int)$matches[1] : null;
                    break;
                }
            }
            return ['device_status' => true, 'latency' => $latency];
        }
    } else {
        $command = "ping -c 1 -W " . $timeout . " " . escapeshellarg($ip_address);
        exec($command, $output, $exit_code);
        if ($exit_code === 0) {
            foreach ($output as $line) {
               if (strpos($line, 'time=') !== false) {
                    preg_match('/time=([\d\.]+)/', $line, $matches);
                    $latency = isset($matches[1]) ? round((float)$matches[1]) : null;
                    break;
                }
            }
            return ['device_status' => true, 'latency' => $latency];
        }
    }
    return ['device_status' => false, 'latency' => null];
}

try {
    // ✅ Database connection
    require_once __DIR__ . '/../db.php';

    // ✅ Prepared statements
    $log_stmt = $pdo->prepare("INSERT INTO logs (switch_id, change_type, old_value, new_value) VALUES (?, ?, ?, ?)");
    $create_alert_stmt = $pdo->prepare("INSERT INTO network_alerts (device_id, title, description) VALUES (?, ?, ?)");
    $resolve_alert_stmt = $pdo->prepare("UPDATE network_alerts SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP WHERE device_id = ? AND status = 'active'");
    $ping_log_stmt = $pdo->prepare("INSERT INTO ping_logs (device_id, latency_ms, status) VALUES (?, ?, ?)");
    $maintenance_check_stmt = $pdo->prepare("SELECT id FROM maintenance_windows WHERE device_id = ? AND start_time <= CURRENT_TIMESTAMP AND end_time >= CURRENT_TIMESTAMP");

    // ✅ FIXED: Select with proper column alias to match JavaScript expectations
    $switches_stmt = $pdo->query("
        SELECT 
            id, 
            name as name, 
            ip_address, 
            device_status, 
            reason, 
            building_id, 
            failed_ping_count,
            '' as model,
            'Switch' as switch_type
        FROM switches
    ");
    $switches = $switches_stmt->fetchAll(PDO::FETCH_ASSOC);

    // Fetch buildings (no change here)
    $buildings_stmt = $pdo->query("SELECT id, name, location FROM buildings ORDER BY name ASC");
    $buildings = $buildings_stmt->fetchAll(PDO::FETCH_ASSOC);
    $grouped_data = [];
    foreach ($buildings as $building) {
        $grouped_data[$building['id']] = [
            'building_name' => $building['name'], 
            'building_location' => $building['location'], 
            'devices' => []
        ];
    }
    $unassigned_devices = [];

    foreach ($switches as &$switch) {
        $maintenance_check_stmt->execute([$switch['id']]);
        if ($maintenance_check_stmt->fetchColumn()) {
            // Set device_status to 2 for Maintenance
            $switch['device_status'] = 2; 
            $switch['reason'] = 'In Maintenance';
        } else {
            $ping_result = get_ping_result($switch['ip_address']);
            $is_alive = $ping_result['device_status'];
            $latency = $ping_result['latency'];
            $current_db_status = (int)$switch['device_status'];

            // Log the ping result
            $ping_log_stmt->execute([$switch['id'], $latency, $is_alive ? 1 : 0]);

            if ($is_alive) {
                // --- LOGIC FOR A SUCCESSFUL PING ---
                // Reset failed ping count and update status
                $new_reason = $latency ? "Online - {$latency}ms" : "Online - Response received";
                
                if ($current_db_status !== 1) {
                    $pdo->prepare("UPDATE switches SET device_status = 1, reason = ?, failed_ping_count = 0 WHERE id = ?")
                        ->execute([$new_reason, $switch['id']]);
                    
                    $log_stmt->execute([$switch['id'], 'status_change', 'Inactive', 'Active']);
                    $resolve_alert_stmt->execute([$switch['id']]);
                } else {
                    // Just update the reason and reset counter
                    $pdo->prepare("UPDATE switches SET failed_ping_count = 0, reason = ? WHERE id = ?")
                        ->execute([$new_reason, $switch['id']]);
                }
                
                $switch['device_status'] = 1;
                $switch['reason'] = $new_reason;
                $switch['failed_ping_count'] = 0;
                
            } else {
                // --- LOGIC FOR A FAILED PING (3-STRIKES) ---
                $failed_count = (int)$switch['failed_ping_count'] + 1;

                if ($failed_count >= 3 && $current_db_status !== 0) {
                    // Mark as down after 3 failed attempts
                    $new_reason = "Ping failed (x{$failed_count}): Host unreachable";
                    $pdo->prepare("UPDATE switches SET device_status = 0, reason = ?, failed_ping_count = ? WHERE id = ?")
                        ->execute([$new_reason, $failed_count, $switch['id']]);

                    $log_stmt->execute([$switch['id'], 'status_change', 'Active', 'Inactive']);
                    $create_alert_stmt->execute([$switch['id'], "Device Down: " . $switch['name'], $new_reason]);
                    
                    $switch['device_status'] = 0;
                    $switch['reason'] = $new_reason;
                    
                } else if ($current_db_status !== 0) {
                    // Increment failure count but don't mark as down yet
                    $pdo->prepare("UPDATE switches SET failed_ping_count = ? WHERE id = ?")
                        ->execute([$failed_count, $switch['id']]);
                    
                    // Show warning but keep as active
                    $base_reason = preg_replace('/\s*\(.*\)/', '', $switch['reason']);
                    $switch['reason'] = "{$base_reason} (Warning: Ping Failed x{$failed_count})";
                }
                $switch['failed_ping_count'] = $failed_count;
            }
        }

        // Group by building
        if (isset($switch['building_id']) && isset($grouped_data[$switch['building_id']])) {
            $grouped_data[$switch['building_id']]['devices'][] = $switch;
        } else {
            $unassigned_devices[] = $switch;
        }
    }
    unset($switch);

    if (!empty($unassigned_devices)) {
        $grouped_data['unassigned'] = [
            'building_name' => 'Unassigned Devices', 
            'building_location' => '', 
            'devices' => $unassigned_devices
        ];
    }

    echo json_encode(['success' => true, 'data' => array_values($grouped_data)]);

} catch (PDOException $e) {
    http_response_code(500);
    error_log("Database Error in get_switches.php: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Database error. Please check server logs.']);
} catch (Exception $e) {
    http_response_code(500);
    error_log("General Error in get_switches.php: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'An error occurred. Please check server logs.']);
}