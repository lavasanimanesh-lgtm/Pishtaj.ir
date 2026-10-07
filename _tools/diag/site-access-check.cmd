@echo off
rem =====================================================================
rem  PTF · SITE ACCESS CHECK (Windows side)  —  2026-10-07
rem  Read-only collector: gathers DNS / hosts / proxy / firewall / AV /
rem  network-route state for a PC where pishtaj.ir does not open, and
rem  writes everything to a single TXT file on the Desktop.
rem
rem  HOW TO USE (send this file to the user, they just double-click it):
rem    1) double-click this file
rem    2) wait 1-3 minutes until you see "DONE"
rem    3) send the file  ptf-site-check.txt  (on the Desktop) to support
rem
rem  It changes NOTHING on the machine. No install, no cleanup.
rem  Companion tool (browser-side): _tools/diag/site-access-check.html
rem  Document: ARENA-SITE-ACCESS-TRIAGE-2026-10-07.md
rem =====================================================================
setlocal
set "LOG=%USERPROFILE%\Desktop\ptf-site-check.txt"
if not exist "%USERPROFILE%\Desktop" set "LOG=%TEMP%\ptf-site-check.txt"

> "%LOG%" echo ===================== PTF SITE ACCESS CHECK =====================
>> "%LOG%" echo Machine: %COMPUTERNAME%    User: %USERNAME%
>> "%LOG%" echo Date: %DATE%  %TIME%
>> "%LOG%" echo Log file: %LOG%
>> "%LOG%" echo ================================================================

call :sec "OS VERSION"
call :cmd ver

call :sec "DNS: pishtaj.ir via system resolver (this is the key test)"
call :cmd nslookup pishtaj.ir

call :sec "DNS: pishtaj.ir via Google DNS 8.8.8.8 (compare with above)"
call :cmd nslookup pishtaj.ir 8.8.8.8

call :sec "DNS: pishtaj.ir via Cloudflare DNS 1.1.1.1"
call :cmd nslookup pishtaj.ir 1.1.1.1

call :sec "DNS SERVERS OF EACH ADAPTER (ipconfig /all)"
call :cmd ipconfig /all

call :sec "OS DNS CACHE entries for pishtaj.ir"
ipconfig /displaydns > "%TEMP%\ptf_dns_all.txt" 2>&1
findstr /i /c:"pishtaj" /c:"157.180.2.34" "%TEMP%\ptf_dns_all.txt" > "%TEMP%\ptf_dnscache.txt" 2>&1
>> "%LOG%" echo --- matching lines from ipconfig /displaydns ---
>> "%LOG%" 2>&1 type "%TEMP%\ptf_dnscache.txt"

call :sec "HOSTS FILE (look for any line containing pishtaj or 157.180.2.34)"
call :cmd type "%SystemRoot%\System32\drivers\etc\hosts"

call :sec "PING by name (3 packets)"
call :cmd ping -n 3 -w 2000 pishtaj.ir

call :sec "PING server IP 157.180.2.34 (3 packets)"
call :cmd ping -n 3 -w 2000 157.180.2.34

call :sec "ROUTE to server IP (tracert, max 12 hops)"
call :cmd tracert -d -w 1000 -h 12 157.180.2.34

call :sec "HTTPS TEST via curl (shows exact failure reason)"
call :cmd curl -v --max-time 20 -o nul https://pishtaj.ir/
call :cmd curl -v --max-time 20 -o nul https://pishtaj.ir/crm/

call :sec "PROXY SETTINGS (Windows WinHTTP)"
call :cmd netsh winhttp show proxy

call :sec "PROXY SETTINGS (user Internet Options)"
call :cmd reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyEnable
call :cmd reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyServer
call :cmd reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v AutoConfigURL

call :sec "IPV6 ADDRESSES (bogus IPv6 can hijack the connection)"
call :cmd powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv6 | Select-Object InterfaceAlias,IPAddress,PrefixOrigin | Format-Table -AutoSize"

call :sec "NETWORK ADAPTERS (look for VPN / tunnel / proxy adapters)"
call :cmd powershell -NoProfile -Command "Get-NetAdapter | Select-Object Name,InterfaceDescription,Status | Format-Table -AutoSize"

call :sec "INSTALLED SECURITY SOFTWARE (antivirus / firewall)"
call :cmd powershell -NoProfile -Command "Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct | Select-Object displayName,productState | Format-List"

call :sec "WINDOWS FIREWALL STATE (all profiles)"
call :cmd netsh advfirewall show allprofiles state

call :sec "LOCAL TCP CONNECTIONS to port 443"
call :cmd powershell -NoProfile -Command "Get-NetTCPConnection -RemotePort 443 -ErrorAction SilentlyContinue | Select-Object -First 20 LocalAddress,RemoteAddress,State | Format-Table -AutoSize"

>> "%LOG%" echo.
>> "%LOG%" echo ============================ DONE ============================
>> "%LOG%" echo Send this file to PTF support.
echo.
echo DONE. Report saved to: %LOG%
echo Please send this file to PTF support.
echo.
pause
exit /b

:sec
>> "%LOG%" echo.
>> "%LOG%" echo ==================== %~1 ====================
exit /b

:cmd
>> "%LOG%" echo.
>> "%LOG%" echo CMD^> %*
>> "%LOG%" 2>&1 %*
exit /b
