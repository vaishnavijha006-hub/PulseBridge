Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 600, 300
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::White)
$font = New-Object System.Drawing.Font "Arial", 16
$brush = [System.Drawing.Brushes]::Black
$text = @"
Dr. Jane Doe, MD
Clinic Rx
Patient: Arjun Sharma
Rx:
Amoxicillin 500mg
Frequency: Twice daily
Duration: 7 days
Instructions: Take after meals with water
"@
$g.DrawString($text, $font, $brush, 30.0, 30.0)
$outputPath = Join-Path $PSScriptRoot "synthetic_rx.png"
$bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Output "Successfully generated $outputPath"
