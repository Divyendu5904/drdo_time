<?php
session_start();
header('Content-Type: application/json');

// ✅ Check if the user is logged in and is the admin
if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true || $_SESSION['username'] !== 'admin') {
    http_response_code(403); // Forbidden
    echo json_encode(['success' => false, 'message' => 'Access denied. Administrator privileges required.']);
    exit;
}

// ✅ Allow only POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Only POST method is allowed.']);
    exit;
}

// ✅ Get user ID from POST
$user_id = $_POST['user_id'] ?? null;

if (empty($user_id) || !is_numeric($user_id)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Valid User ID is required.']);
    exit;
}

try {
    // ✅ MySQL connection from db.php
    require_once __DIR__ . '/../db.php';

    // ✅ Delete only if not admin
    $stmt = $pdo->prepare("DELETE FROM users WHERE id = ? AND username != 'admin'");
    $stmt->execute([$user_id]);

    if ($stmt->rowCount() > 0) {
        echo json_encode(['success' => true, 'message' => 'User deleted successfully.']);
    } else {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'User not found or cannot delete the main admin.']);
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
