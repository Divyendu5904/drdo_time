<?php
session_start();
header('Content-Type: application/json');

// ✅ User Authentication
if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'User not authenticated.']);
    exit;
}

// ✅ Allow only GET requests for this checker
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Only GET method is allowed.']);
    exit;
}

// ✅ Get and validate the IP address from the query string
$ip_address = $_GET['ip_address'] ?? null;

if (empty($ip_address) || !filter_var($ip_address, FILTER_VALIDATE_IP)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'A valid IP address is required.']);
    exit;
}

/**
 * Performs a ping to a given IP address to check if it's reachable.
 * This function is robust and works on both Windows and Linux systems.
 *
 * @param string $ip_address The IP address to ping.
 * @param int    $timeout    The timeout in seconds.
 * @return array An array containing 'device_status' (boolean) and 'latency' (int|null).
 */
function get_ping_result($ip_address, $timeout = 1) {
    $latency = null;
    $exit_code = 1; 
    $output = [];

    // Determine the correct ping command based on the operating system
    if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
        // Windows command
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
        // Linux/macOS command
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
    // Return false if the ping command fails (exit_code is not 0)
    return ['device_status' => false, 'latency' => null];
}

try {
    // ✅ Connect to the database using your existing db.php file
    require_once __DIR__ . '/../db.php';

    $ping_result = get_ping_result($ip_address);
    
    if ($ping_result['device_status']) {
        // ✅ If active, update the database to reflect this status
        $new_reason = "Online - {$ping_result['latency']}ms";
        $update_stmt = $pdo->prepare("UPDATE switches SET device_status = 1, reason = ? WHERE ip_address = ?");
        $update_stmt->execute([$new_reason, $ip_address]);

        echo json_encode([
            'success' => true, 
            'status' => 'active', 
            'latency' => $ping_result['latency']
        ]);
    } else {
        // ✅ If inactive, update the database as well
        $new_reason = 'Ping failed: Host unreachable';
        $update_stmt = $pdo->prepare("UPDATE switches SET device_status = 0, reason = ? WHERE ip_address = ?");
        $update_stmt->execute([$new_reason, $ip_address]);

        echo json_encode([
            'success' => true, 
            'status' => 'inactive',
            'latency' => null
        ]);
    }

} catch (PDOException $e) {
    http_response_code(500);
    // In a production environment, log the error instead of echoing it
    error_log('Database Connection Error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
} catch (Exception $e) {
    http_response_code(500);
    // In a production environment, log the error instead of echoing it
    error_log('Live Status Check Error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'An internal error occurred while checking status.']);
}
