<?php
session_start();
header('Content-Type: application/json');

// ✅ Authentication check
if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'User not authenticated.']);
    exit;
}

// ✅ Get device ID from query
$device_id = $_GET['device_id'] ?? null;

if (empty($device_id)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Device ID is required.']);
    exit;
}

try {
    // ✅ MySQL DB connection
    require_once __DIR__ . '/../db.php'; // assumes db.php sets up $pdo

    // ✅ Prepare MySQL-compatible 24-hour log query
    $stmt = $pdo->prepare("
        SELECT timestamp, latency_ms, status 
        FROM ping_logs 
        WHERE device_id = ? AND timestamp >= NOW() - INTERVAL 24 HOUR
        ORDER BY timestamp ASC
    ");
    $stmt->execute([$device_id]);
    $history = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'data' => $history]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'An error occurred: ' . $e->getMessage()]);
}
