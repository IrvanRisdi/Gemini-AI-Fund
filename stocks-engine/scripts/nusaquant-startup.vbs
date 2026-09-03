' Launch NusaQuant without opening a console window when Windows signs in.
Set shell = CreateObject("WScript.Shell")
command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File " & Chr(34) & "C:\Users\PLN\Documents\ChatGPT\Saham\scripts\start-nusaquant.ps1" & Chr(34)
shell.Run command, 0, False
