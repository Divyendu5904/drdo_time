<?php
session_start();

header('Content-Type: application/json');

// ✅ Check session authentication
if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'User not authenticated.']);
    exit;
}

try {
    // ✅ Connect to MySQL using db.php
    require_once __DIR__ . '/../db.php'; // Ensure this defines $pdo

    // ✅ Query for upcoming/active maintenance windows with device names
    $stmt = $pdo->query("
        SELECT 
            m.id, 
            m.device_id, 
            m.start_time, 
            m.end_time, 
            m.reason, 
            m.created_by,
            s.name AS device_name
        FROM maintenance_windows m
        INNER JOIN switches s ON m.device_id = s.id
        WHERE m.end_time > NOW()
        ORDER BY m.start_time ASC
    ");

    $windows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'data' => $windows]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
