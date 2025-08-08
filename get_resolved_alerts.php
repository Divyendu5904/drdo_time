<?php
session_start();

header('Content-Type: application/json');

// ✅ Ensure user is authenticated
if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'User not authenticated.']);
    exit;
}

try {
    // ✅ Connect to MySQL using db.php
    require_once __DIR__ . '/../db.php'; // Ensure this defines $pdo

    // ✅ Fetch the 20 most recently resolved alerts with device names and severity
    $stmt = $pdo->query("
        SELECT 
            a.id, 
            a.title, 
            a.description, 
            a.created_at, 
            a.resolved_at,
            s.name AS device_name
        FROM network_alerts a
        INNER JOIN switches s ON a.device_id = s.id
        WHERE a.status = 'resolved'
        ORDER BY a.resolved_at DESC
        LIMIT 20
    ");
    
    $alerts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'data' => $alerts]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
?>