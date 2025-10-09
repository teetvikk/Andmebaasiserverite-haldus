
-- =====================================================================
-- 1. Lähinädala kodutööd (WHERE + ORDER BY + LIMIT)
-- ---------------------------------------------------------------------
-- Eesmärk: Näidata õpetajale ja õpilastele, millised kodutööd tuleb esitada
-- järgmise 7 päeva jooksul.
-- Oodatav tulemus: Tagastab kodutööde pealkirjad, klassid ja tähtaegade kuupäevad.
-- =====================================================================
SELECT 
    a.title AS assignment_title,
    s.name AS subject_name,
    c.name AS class_name,
    CONCAT(u.first_name, ' ', u.last_name) AS teacher_name,
    a.due_date
FROM assignments a
JOIN subjects s ON a.subject_id = s.id
JOIN classes c ON a.class_id = c.id
JOIN users u ON a.creator_id = u.id
WHERE a.due_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)
ORDER BY a.due_date ASC
LIMIT 10;


-- =====================================================================
-- 2. Õpilased, kes puudusid viimase nädala jooksul (WHERE + JOIN 3 tabelit)
-- ---------------------------------------------------------------------
-- Eesmärk: Aidata klassijuhatajal jälgida õpilaste hiljutisi puudumisi.
-- Oodatav tulemus: Näitab iga puudunud õpilase nime, klassi ja tunni teemat.
-- =====================================================================
SELECT 
    CONCAT(u.first_name, ' ', u.last_name) AS student_name,
    c.name AS class_name,
    l.date AS lesson_date,
    l.topic AS lesson_topic
FROM attendance att
JOIN users u ON att.student_id = u.id
JOIN lessons l ON att.lesson_id = l.id
JOIN classes c ON l.class_id = c.id
WHERE att.status = 'absent'
  AND l.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
ORDER BY c.name, l.date, student_name;


-- =====================================================================
-- 3. Iga klassi õpilaste arv (GROUP BY + COUNT)
-- ---------------------------------------------------------------------
-- Eesmärk: Näidata administraatorile, mitu õpilast igas klassis on.
-- Oodatav tulemus: Tagastab klassinime ja õpilaste koguarvu igas klassis.
-- =====================================================================
SELECT 
    c.name AS class_name,
    COUNT(cm.user_id) AS student_count
FROM classes c
LEFT JOIN class_memberships cm ON c.id = cm.class_id
GROUP BY c.id, c.name
ORDER BY student_count DESC;


-- =====================================================================
-- 4. Õpetajate antud tundide arv viimase kuu jooksul (GROUP BY + WHERE)
-- ---------------------------------------------------------------------
-- Eesmärk: Aruandlus õpetajate töökoormuse kohta viimase 30 päeva jooksul.
-- Oodatav tulemus: Näitab, mitu tundi iga õpetaja on andnud viimase kuu jooksul.
-- =====================================================================
SELECT 
    CONCAT(u.first_name, ' ', u.last_name) AS teacher_name,
    COUNT(l.id) AS lessons_taught
FROM lessons l
JOIN users u ON l.teacher_id = u.id
WHERE l.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY u.id, u.first_name, u.last_name
HAVING COUNT(l.id) > 0
ORDER BY lessons_taught DESC;


-- =====================================================================
-- 5. Hindamata esitamised (LEFT JOIN + WHERE + ORDER BY)
-- ---------------------------------------------------------------------
-- Eesmärk: Näidata õpetajatele, millised esitatud tööd ootavad veel hindamist.
-- Oodatav tulemus: Tagastab iga hindamata töö info koos õpilase nime ja tähtajaga.
-- =====================================================================
SELECT 
    s.id AS submission_id,
    CONCAT(stu.first_name, ' ', stu.last_name) AS student_name,
    a.title AS assignment_title,
    s.submitted_at,
    a.due_date
FROM submissions s
JOIN users stu ON s.student_id = stu.id
JOIN assignments a ON s.assignment_id = a.id
LEFT JOIN grades g ON g.submission_id = s.id
WHERE g.id IS NULL
ORDER BY a.due_date ASC, s.submitted_at DESC;


-- =====================================================================
-- 6. Ainete keskmised hinded (AVG + GROUP BY + HAVING)
-- ---------------------------------------------------------------------
-- Eesmärk: Anda ülevaade, millistes ainetes on õpilaste tulemused paremad.
-- Oodatav tulemus: Tagastab iga aine nime ja keskmise hinde väärtuse.
-- =====================================================================
SELECT 
    subj.name AS subject_name,
    ROUND(AVG(
        CASE 
            WHEN g.grade_value IN ('1','2','3','4','5') THEN CAST(g.grade_value AS UNSIGNED)
            WHEN g.grade_value = 'PASSED' THEN 5
            WHEN g.grade_value = 'FAILED' THEN 1
        END
    ), 2) AS average_grade
FROM grades g
JOIN submissions s ON g.submission_id = s.id
JOIN assignments a ON s.assignment_id = a.id
JOIN subjects subj ON a.subject_id = subj.id
GROUP BY subj.id, subj.name
HAVING average_grade IS NOT NULL
ORDER BY average_grade DESC;
