SELECT 
  u.id,
  u.name,
  u.email
FROM users u
WHERE u.active = true
ORDER BY u.name;
