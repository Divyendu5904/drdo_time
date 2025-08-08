<?php
session_start();
header('Content-Type: application/json');

// ✅ Check if user is logged in
if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'User not authenticated.']);
    exit;
}

// ✅ Read and decode JSON input
$input = file_get_contents("php://input");
$data = json_decode($input, true);

// ✅ Validate input
if (
    !isset($data['error_code']) || empty(trim($data['error_code'])) ||
    !isset($data['title']) || empty(trim($data['title'])) ||
    !isset($data['description']) || empty(trim($data['description'])) ||
    !isset($data['solution']) || empty(trim($data['solution']))
) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid input',
        'received' => $data
    ]);
    exit;
}

// ✅ Connect to MySQL using db.php
require_once __DIR__ . '/../db.php';

try {
    // ✅ Insert or update using ON DUPLICATE KEY UPDATE (MySQL style)
    $stmt = $pdo->prepare("
        INSERT INTO error_guides (error_code, title, description, solution)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            description = VALUES(description),
            solution = VALUES(solution)
    ");

    $stmt->execute([
        $data['error_code'],
        $data['title'],
        $data['description'],
        $data['solution']
    ]);

    echo json_encode(['success' => true, 'message' => 'Guide added or updated successfully']);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database Error: ' . $e->getMessage()]);
}
