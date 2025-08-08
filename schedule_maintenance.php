<?php
session_start();
header('Content-Type: application/json');

// ✅ Role check: Only admin and operator allowed
if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true || !in_array($_SESSION['role'], ['admin', 'operator'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Access denied.']);
    exit;
}

// ✅ Get POST data
$device_id = $_POST['device_id'] ?? null;
$start_time = $_POST['start_time'] ?? null;
$end_time = $_POST['end_time'] ?? null;
$reason = trim($_POST['reason'] ?? 'Scheduled Maintenance');

// ✅ Validate input
if (empty($device_id) || empty($start_time) || empty($end_time)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Device ID, start time, and end time are required.']);
    exit;
}

// ✅ Connect to MySQL
require_once __DIR__ . '/../db.php'; // This should define $pdo

try {
    // ✅ Insert maintenance window
    $stmt = $pdo->prepare("
        INSERT INTO maintenance_windows (device_id, start_time, end_time, reason, created_by)
        VALUES (?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $device_id,
        $start_time,
        $end_time,
        $reason,
        $_SESSION['username']
    ]);

    echo json_encode(['success' => true, 'message' => 'Maintenance window scheduled successfully.']);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
