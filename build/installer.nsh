!macro customCheckAppRunning
  DetailPrint "Closing running ${PRODUCT_NAME} processes before updating..."
  ${nsProcess::CloseProcess} "${APP_EXECUTABLE_FILENAME}" $0
  Sleep 800
  ${nsProcess::KillProcess} "${APP_EXECUTABLE_FILENAME}" $0
  ${nsProcess::Unload}
!macroend

; Persist the language selected by the NSIS language dialog. SHCTX follows the
; selected installation scope, so both per-user and all-users installs work.
!macro customInstall
  ${If} $LANGUAGE == ${LANG_SIMPCHINESE}
    WriteRegStr SHCTX "Software\\cn.fujian.desktopnotes" "InstallLanguage" "zh"
  ${Else}
    WriteRegStr SHCTX "Software\\cn.fujian.desktopnotes" "InstallLanguage" "en"
  ${EndIf}
  ReadRegDWORD $0 SHCTX "Software\\cn.fujian.desktopnotes" "InstallLanguageGeneration"
  ${If} $0 == ""
    StrCpy $0 0
  ${EndIf}
  IntOp $0 $0 + 1
  WriteRegDWORD SHCTX "Software\\cn.fujian.desktopnotes" "InstallLanguageGeneration" $0
!macroend
