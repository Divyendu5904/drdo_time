<?php
session_start();
header('Content-Type: application/json');

// ✅ Role-based access control
if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true || !in_array($_SESSION['role'], ['admin', 'operator'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Access denied.']);
    exit;
}

// ✅ Get and validate input
$window_id = $_POST['window_id'] ?? null;
if (empty($window_id) || !is_numeric($window_id)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Maintenance Window ID is required.']);
    exit;
}

try {
    // ✅ MySQL connection from db.php
    require_once __DIR__ . '/../db.php';

    // ✅ Delete the maintenance window
    $stmt = $pdo->prepare("DELETE FROM maintenance_windows WHERE id = ?");
    $stmt->execute([$window_id]);

    if ($stmt->rowCount() > 0) {
        echo json_encode(['success' => true, 'message' => 'Maintenance window cancelled.']);
    } else {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Window not found.']);
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
