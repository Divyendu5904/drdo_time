<?php
session_start();
header('Content-Type: application/json');

// ✅ Only allow admin access
if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true || $_SESSION['role'] !== 'admin') {
    http_response_code(403); // Forbidden
    echo json_encode(['success' => false, 'message' => 'Access denied. Administrator privileges required.']);
    exit;
}

try {
    // ✅ Connect to MySQL database
    require_once __DIR__ . '/../db.php'; // Make sure db.php returns a valid $pdo

    // ✅ Fetch all non-admin users
    $stmt = $pdo->prepare("SELECT id, username, role, created_at FROM users WHERE username != 'admin' ORDER BY username ASC");
    $stmt->execute();
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'data' => $users]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred: ' . $e->getMessage()
    ]);
}
