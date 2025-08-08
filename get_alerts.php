<?php
session_start();
header('Content-Type: application/json');

// ✅ Check if user is authenticated
if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'User not authenticated.']);
    exit;
}

try {
    // ✅ Use MySQL connection
    require_once __DIR__ . '/../db.php';

    // ✅ Prepare and execute query for active alerts joined with switch names
    $stmt = $pdo->prepare("
        SELECT 
            a.id, 
            a.title, 
            a.description, 
            a.severity, 
            a.created_at, 
            s.name AS device_name
        FROM network_alerts a
        JOIN switches s ON a.device_id = s.id
        WHERE a.status = 'active'
        ORDER BY a.created_at DESC
    ");
    $stmt->execute();

    $alerts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'data' => $alerts]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
