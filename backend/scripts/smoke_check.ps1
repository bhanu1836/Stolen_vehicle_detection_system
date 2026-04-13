$ErrorActionPreference='Stop'
$baseUrl = if ($env:SMOKE_BASE_URL) { $env:SMOKE_BASE_URL } else { 'http://localhost:8000' }

function PostJson($path, $obj, $token='') {
  $headers=@{}
  if ($token) { $headers['Authorization'] = "Bearer $token" }
  return Invoke-RestMethod -Uri ($baseUrl+$path) -Method POST -ContentType 'application/json' -Headers $headers -Body ($obj|ConvertTo-Json -Depth 8)
}

function GetJson($path, $token='') {
  $headers=@{}
  if ($token) { $headers['Authorization'] = "Bearer $token" }
  return Invoke-RestMethod -Uri ($baseUrl+$path) -Method GET -Headers $headers
}

function TryLogin($email,$password) {
  try { return PostJson '/auth/login' @{email=$email; password=$password} } catch { return $null }
}

$root = GetJson '/'
"backend_up=true"
"root_message=$($root.message)"

$email = "smoke.$(Get-Date -Format 'yyyyMMddHHmmss')@example.com"
$pass = 'Smoketest@123'

$reg = PostJson '/auth/customer/register' @{full_name='Smoke User'; email=$email; phone='9000000000'; password=$pass}
$login = PostJson '/auth/login' @{email=$email; password=$pass}
"customer_register=200"
"customer_login_role=$($login.user.role)"

$vehicle = PostJson '/customer/stolen-vehicles' @{
  vehicle_number = "TS09AB$((Get-Random -Minimum 1000 -Maximum 9999))"
  vehicle_type = 'Car'
  make = 'TestMake'
  model = 'TestModel'
  color = 'White'
  last_seen_location = 'Smoke Test Checkpoint'
  last_seen_time = (Get-Date).ToUniversalTime().ToString('o')
  notes = 'Smoke test report'
} $login.token
"customer_report_vehicle=200"
"reported_vehicle=$($vehicle.vehicle.vehicle_number)"

$adminCandidates=@(@{email='r210389@rguktrkv.ac.in';password='admin@123'},@{email='admin@portal.local';password='Admin@123'})
$policeCandidates=@(@{email='police@gmail.com';password='police@123'},@{email='police@portal.local';password='Police@123'})

$admin=$null
foreach($c in $adminCandidates){
  $admin=TryLogin $c.email $c.password
  if($admin){break}
}
if($admin){
  "admin_login_role=$($admin.user.role)"
  "admin_login_email=$($admin.user.email)"
} else {
  "admin_login_role=FAILED"
}

$police=$null
foreach($c in $policeCandidates){
  $police=TryLogin $c.email $c.password
  if($police){break}
}
if($police){
  "police_login_role=$($police.user.role)"
  "police_login_email=$($police.user.email)"
} else {
  "police_login_role=FAILED"
}

if($admin){
  $tiny='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6p9XkAAAAASUVORK5CYII='
  $d=PostJson '/admin/detect' @{location='Smoke Test Camera';frames=@(@{data="data:image/png;base64,$tiny"})} $admin.token
  "admin_detect_http=200"
  "admin_detect_match_found=$($d.match_found)"
  if($d.case_id){ "admin_detect_case_id=$($d.case_id)" }

  $ins=GetJson '/admin/insights' $admin.token
  "admin_insights_http=200"
  "open_cases=$($ins.open_cases)"
}

if($police){
  $cases=GetJson '/police/cases' $police.token
  "police_cases_http=200"
  "police_cases_count=$(@($cases.cases).Count)"
}
