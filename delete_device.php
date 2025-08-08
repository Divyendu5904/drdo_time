<?php
session_start();
header('Content-Type: application/json');

// ✅ Auth check
if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
    http_response_code(401); // Unauthorized
    echo json_encode(['success' => false, 'message' => 'User not authenticated.']);
    exit;
}

// ✅ Method check
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); // Method Not Allowed
    echo json_encode(['success' => false, 'message' => 'Only POST method is allowed.']);
    exit;
}

// ✅ Get POST data
$device_id = $_POST['device_id'] ?? null;

// ✅ Validate input
if (empty($device_id)) {
    http_response_code(400); // Bad Request
    echo json_encode(['success' => false, 'message' => 'Device ID is required.']);
    exit;
}

try {
    // ✅ Connect to MySQL
    require_once __DIR__ . '/../db.php'; // Make sure this defines $pdo

    // ✅ Fetch device name for logging
    $name_stmt = $pdo->prepare("SELECT name FROM switches WHERE id = ?");
    $name_stmt->execute([$device_id]);
    $device = $name_stmt->fetch(PDO::FETCH_ASSOC);
    $device_name = $device ? $device['name'] : 'Unknown Device';

    // ✅ Delete the device
    $stmt = $pdo->prepare("DELETE FROM switches WHERE id = ?");
    $stmt->execute([$device_id]);

    if ($stmt->rowCount() > 0) {
        // ✅ Log the deletion
        $log_stmt = $pdo->prepare("INSERT INTO logs (switch_id, change_type, new_value) VALUES (?, ?, ?)");
        $log_stmt->execute([null, 'device_delete', "Device '{$device_name}' was deleted."]);

        echo json_encode(['success' => true, 'message' => 'Device deleted successfully.']);
    } else {
        http_response_code(404); // Not Found
        echo json_encode(['success' => false, 'message' => 'Device not found.']);
    }

} catch (PDOException $e) {
    http_response_code(500); // Internal Server Error
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
