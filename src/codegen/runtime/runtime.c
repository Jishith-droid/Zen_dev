#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>

//
// ===============================
// INT → STRING
// ===============================
//

char* int_to_string(int x) {
    char* res = (char*)malloc(20);
    
    int i = 0;
    int isNeg = 0;

    if (x == 0) {
        res[i++] = '0';
        res[i] = '\0';
        return res;
    }

    if (x < 0) {
        isNeg = 1;
        x = -x;
    }

    char temp[20];
    int t = 0;

    while (x > 0) {
        temp[t++] = (x % 10) + '0';
        x /= 10;
    }

    if (isNeg) {
        res[i++] = '-';
    }

    while (t > 0) {
        res[i++] = temp[--t];
    }

    res[i] = '\0';
    return res;
}

//
// ===============================
// DOUBLE → STRING
// ===============================
//
char* double_to_string(double x) {
    char buffer[64];
    snprintf(buffer, sizeof(buffer), "%f", x);

    char* res = (char*)malloc(strlen(buffer) + 1);
    strcpy(res, buffer);

    return res;
}

//
// ===============================
// BOOL → STRING
// ===============================
//
char* bool_to_string(bool x) {
    const char* str = x ? "true" : "false";

    char* res = (char*)malloc(strlen(str) + 1);
    strcpy(res, str);

    return res;
}

//
// ===============================
// STRING → INT
// ===============================
//

/*int string_to_int(char* str) {
    if (str == NULL) return 0;
    return atoi(str);
}
*/

int string_to_int(char* str) {
    if (str == NULL) return 0;

    int result = 0;
    int i = 0;
    int sign = 1;

    if (str[0] == '-') {
        sign = -1;
        i++;
    }

    while (str[i] != '\0') {
        if (str[i] < '0' || str[i] > '9') {
            break; // or handle error
        }

        result = result * 10 + (str[i] - '0');
        i++;
    }

    return result * sign;
}

int string_to_int_ascii(char *str) {
    int result = 0;

    while (*str) {
        result += (int)(*str);
        str++;
    }

    return result;
}

char* int_to_string_ascii(int value) {
    char *out = (char*)malloc(2);

    out[0] = (char)value;
    out[1] = '\0';

    return out;
}

//
// ===============================
// STRING → DOUBLE
// ===============================
//
double string_to_double(char* str) {
    if (str == NULL) return 0.0;
    return atof(str);
}

//
// ===============================
// STRING → BOOL
// ===============================
//
bool string_to_bool(char* str) {
    return (str != NULL && strlen(str) > 0);
}

//
// ===============================
// OPTIONAL: FREE STRING
// ===============================
//
void free_string(char* str) {
    if (str != NULL) {
        free(str);
    }
}

char* str_concat(const char* a, const char* b) {
    if (!a) a = "";
    if (!b) b = "";

    size_t len_a = strlen(a);
    size_t len_b = strlen(b);

    char* res = (char*)malloc(len_a + len_b + 1);
    if (!res) return NULL;

    memcpy(res, a, len_a);
    memcpy(res + len_a, b, len_b);
    res[len_a + len_b] = '\0';

    return res;
}

char* zen_char_to_string(char c) {
    char* s = (char*)malloc(2);
    s[0] = c;
    s[1] = '\0';
    return s;
}