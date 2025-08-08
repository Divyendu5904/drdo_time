<?php
session_start();
header('Content-Type: application/json');

// ✅ Check login session
if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'User not authenticated.']);
    exit;
}

// ✅ Read JSON input
$data = json_decode(file_get_contents('php://input'), true);

// ✅ Validate input
if (!$data || !isset($data['id']) || !is_numeric($data['id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid input. Guide ID is required.']);
    exit;
}

try {
    // ✅ Connect to MySQL (make sure db.php defines $pdo)
    require_once __DIR__ . '/../db.php';

    // ✅ Execute deletion
    $stmt = $pdo->prepare("DELETE FROM error_guides WHERE id = ?");
    $stmt->execute([$data['id']]);

    if ($stmt->rowCount() > 0) {
        echo json_encode(['success' => true, 'message' => 'Guide deleted successfully.']);
    } else {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Guide not found.']);
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
