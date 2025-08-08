<?php
session_start();
header('Content-Type: application/json');

// ✅ Authentication check
if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'User not authenticated.']);
    exit;
}

// ✅ Read JSON body
$data = json_decode(file_get_contents('php://input'), true);

// ✅ Validate input
if (
    !$data ||
    !isset($data['id']) ||
    !isset($data['error_code']) ||
    !isset($data['description']) ||
    !isset($data['solution'])
) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid input', 'received' => $data]);
    exit;
}

try {
    // ✅ Use MySQL connection from db.php
    require_once __DIR__ . '/../db.php'; // assumes $pdo is created inside

    // ✅ Update the guide
    $stmt = $pdo->prepare("
        UPDATE error_guides 
        SET error_code = ?, description = ?, solution = ?
        WHERE id = ?
    ");
    $stmt->execute([
        $data['error_code'],
        $data['description'],
        $data['solution'],
        $data['id']
    ]);

    echo json_encode(['success' => true, 'message' => 'Guide updated successfully']);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
?>
