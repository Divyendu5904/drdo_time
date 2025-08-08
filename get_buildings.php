<?php
session_start();
header('Content-Type: application/json');

// ✅ Check if user is logged in
if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
    http_response_code(401); // Unauthorized
    echo json_encode(['success' => false, 'message' => 'User not authenticated.']);
    exit;
}

try {
    // ✅ Include MySQL DB connection
    require_once __DIR__ . '/../db.php';

    // ✅ Fetch buildings sorted by name
    $stmt = $pdo->query("SELECT id, name, location FROM buildings ORDER BY name ASC");
    $buildings = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'data' => $buildings]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
