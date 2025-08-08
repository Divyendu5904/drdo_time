<?php
session_start();
header('Content-Type: application/json');

// ✅ Authentication check
if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'User not authenticated.']);
    exit;
}

// ✅ Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Only POST method is allowed.']);
    exit;
}

// ✅ Get POST data
$device_id = $_POST['device_id'] ?? null;
$name = trim($_POST['name'] ?? '');
$ip_address = trim($_POST['ip_address'] ?? '');
$building_id = $_POST['building_id'] ?? null;

// ✅ Input Validation
if (empty($device_id) || empty($name) || empty($ip_address) || empty($building_id)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Device ID, Name, IP Address, and Building are all required.']);
    exit;
}

if (!filter_var($ip_address, FILTER_VALIDATE_IP)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid IP address format.']);
    exit;
}

// ✅ Connect to MySQL
require_once __DIR__ . '/../db.php';

try {
    // ✅ Prevent duplicate IP for another device
    $check_ip = $pdo->prepare("SELECT id FROM switches WHERE ip_address = ? AND id != ?");
    $check_ip->execute([$ip_address, $device_id]);
    if ($check_ip->fetch()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Another device already uses this IP address.']);
        exit;
    }

    // ✅ Perform the update
    $stmt = $pdo->prepare("UPDATE switches SET name = ?, ip_address = ?, building_id = ? WHERE id = ?");
    $stmt->execute([$name, $ip_address, $building_id, $device_id]);

    // ✅ Log the update
    $log_stmt = $pdo->prepare("INSERT INTO logs (switch_id, change_type, new_value) VALUES (?, ?, ?)");
    $log_stmt->execute([$device_id, 'device_update', "Device '{$name}' updated."]);

    echo json_encode(['success' => true, 'message' => 'Device updated successfully.']);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
?>
