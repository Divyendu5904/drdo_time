<?php
session_start();
header('Content-Type: application/json');

// ✅ Ensure user is logged in
if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'User not authenticated.']);
    exit;
}

// ✅ Ensure method is POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Only POST method is allowed.']);
    exit;
}

// ✅ Parse JSON body
$input = json_decode(file_get_contents("php://input"), true);
$alert_id = $input['alert_id'] ?? null;

// ✅ Validate input
if (empty($alert_id) || !is_numeric($alert_id)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Valid alert ID is required.']);
    exit;
}

// ✅ Connect to MySQL
require_once __DIR__ . '/../db.php'; // Make sure this file sets up $pdo for MySQL

try {
    // ✅ Resolve alert
    $stmt = $pdo->prepare("UPDATE network_alerts SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP WHERE id = ?");
    $stmt->execute([$alert_id]);

    if ($stmt->rowCount() > 0) {
        echo json_encode(['success' => true, 'message' => 'Alert resolved successfully.']);
    } else {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Alert not found or already resolved.']);
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
