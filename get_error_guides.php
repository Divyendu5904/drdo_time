<?php
session_start();
header('Content-Type: application/json');

// ✅ Check authentication
if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'User not authenticated.']);
    exit;
}

// ✅ Get optional search query
$search_query = $_GET['q'] ?? '';

try {
    // ✅ Connect to MySQL (via db.php)
    require_once __DIR__ . '/../db.php'; // ensures $pdo is defined

    if (!empty($search_query)) {
        // 🔍 Search by title, description, or error_code
        $stmt = $pdo->prepare("
            SELECT id, error_code, title, description, solution, created_at 
            FROM error_guides 
            WHERE title LIKE :query OR description LIKE :query OR error_code LIKE :query
            ORDER BY created_at DESC
        ");
        $stmt->execute([':query' => '%' . $search_query . '%']);
    } else {
        // 📦 Fetch all records
        $stmt = $pdo->query("
            SELECT id, error_code, title, description, solution, created_at 
            FROM error_guides 
            ORDER BY created_at DESC
        ");
    }

    $guides = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['success' => true, 'data' => $guides]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
