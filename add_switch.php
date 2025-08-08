<?php
session_start();
header('Content-Type: application/json');

// ✅ Check login
if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
    http_response_code(401); // Unauthorized
    echo json_encode(['success' => false, 'message' => 'User not authenticated.']);
    exit;
}

// ✅ Allow only POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Only POST method is allowed.']);
    exit;
}

// ✅ Get and validate input
$name = $_POST['name'] ?? null;
$ip_address = $_POST['ip_address'] ?? null;
// Default status to 0 (Inactive/Pending) until the first check confirms it's online.
$device_status = isset($_POST['device_status']) ? (int)$_POST['device_status'] : 0;
$reason = $_POST['reason'] ?? '';
$building_id = $_POST['building_id'] ?? null;

if (empty($name) || empty($ip_address) || empty($building_id)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Name, IP address, and Building are required.']);
    exit;
}

if (!filter_var($ip_address, FILTER_VALIDATE_IP)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid IP address format.']);
    exit;
}

// Provide a clearer default reason if one isn't given for a specific status
if (empty($reason)) {
    if ($device_status === 0) {
        $reason = 'Newly added, pending status check.';
    } elseif ($device_status === 1) {
        $reason = 'Manually added as active.';
    }
}

// ✅ Connect to MySQL using db.php
require_once __DIR__ . '/../db.php';

try {
    // ✅ Insert switch, now including the failed_ping_count
    $stmt = $pdo->prepare("
        INSERT INTO switches (name, ip_address, device_status, reason, building_id, failed_ping_count)
        VALUES (?, ?, ?, ?, ?, 0)
    ");
    $stmt->execute([$name, $ip_address, $device_status, $reason, $building_id]);

    $switch_id = $pdo->lastInsertId();

    // ✅ Insert into logs
    $log_stmt = $pdo->prepare("
        INSERT INTO logs (switch_id, change_type, new_value)
        VALUES (?, 'new_device', ?)
    ");
    $log_stmt->execute([$switch_id, "Added '{$name}' with IP {$ip_address}"]);

    echo json_encode(['success' => true, 'message' => 'Device added successfully.']);
} catch (PDOException $e) {
    // Check for duplicate entry
    if ($e->getCode() == 23000) {
        http_response_code(409); // Conflict
        echo json_encode(['success' => false, 'message' => 'Error: IP address already exists.']);
    } else {
        http_response_code(500); // Internal Server Error
        // In a production environment, you might want to log the specific error but not show it to the user.
        error_log('Database Error in add_switch.php: ' . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'A database error occurred.']);
    }
}
