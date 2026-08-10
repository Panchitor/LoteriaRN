set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
cd c:\LotAgencia\app-tv
call npx expo prebuild -p android
cd android
call gradlew assembleRelease
