@NAN = external constant double
@NEG_INF = external constant double
@INF = external constant double
@F64_EPS = external constant double
@F64_MIN = external constant double
@F64_MAX = external constant double
@I32_MIN = external constant i32
@I32_MAX = external constant i32
@SEED = external global i32
@LN10 = external constant double
@LN2 = external constant double
@SQRT2 = external constant double
@PHI = external constant double
@E = external constant double
@TAU = external constant double
@PI = external constant double
define void @screen_string_0(i8* %x) {
entry:
  call i32 (i8*, ...) @printf(i8* getelementptr ([4 x i8], [4 x i8]* @.fmt_string_0, i32 0, i32 0),
    i8* %x)
  call i32 @fflush(i8* null)
  ret void
}
@.fmt_string_0 = private constant [4 x i8] c"%s\0A\00"
declare i32 @fflush(i8*)
declare i32 @printf(i8*, ...)
@.str0 = private unnamed_addr constant [19 x i8] c"wow zen working ;)\00"
define i32 @main() { 
entry:

%t0 = getelementptr inbounds [19 x i8], [19 x i8]* @.str0, i32 0, i32 0
call void @screen_string_0(i8* %t0)
ret i32 0 
}