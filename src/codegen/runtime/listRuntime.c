// ========================================================
// ZEN LIST RUNTIME
// ========================================================

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <stdarg.h>



void** zen_args_new(int count) {
    return (void**)malloc(sizeof(void*) * count);
}

void zen_args_set(void** args, int index, void* value) {
    args[index] = value;
}



// ========================================================
// LIST STRUCT
// ========================================================

typedef struct {
void* data;
int size;
int capacity;
size_t element_size;
} ZenList;

// ========================================================
// CREATE
// ========================================================

ZenList* zen_list_new(size_t element_size) {

ZenList* list = (ZenList*)malloc(sizeof(ZenList));  

list->data = NULL;  
list->size = 0;  
list->capacity = 0;  
list->element_size = element_size;  

return list;

}

// ========================================================
// GROW
// ========================================================

void zen_list_grow(ZenList* list) {

int new_capacity;  

if (list->capacity == 0) {  
    new_capacity = 4;  
} else {  
    new_capacity = list->capacity * 2;  
}  

void* new_data = malloc(  
    new_capacity * list->element_size  
);  

// copy old  
if (list->data != NULL) {  

    memcpy(  
        new_data,  
        list->data,  
        list->size * list->element_size  
    );  

    free(list->data);  
}  

list->data = new_data;  
list->capacity = new_capacity;

}

// ========================================================
// PUSH
// ========================================================

void zen_list_push(ZenList* list, void* value) {

if (list->size >= list->capacity) {  
    zen_list_grow(list);  
}  

char* base = (char*)list->data;  

memcpy(  
    base + (list->size * list->element_size),  
    value,  
    list->element_size  
);  

list->size++;

}

// ========================================================
// GET
// ========================================================

void* zen_list_get(ZenList* list, int index) {

if (index < 0 || index >= list->size) {
    fprintf(stderr, "\033[1;31m[Zen  IndexError]\n  └── Index %d is out of bounds for List of length %d — valid range is 0 to %d\033[0m\n", index, list->size, list->size - 1);
    exit(1);
}  

char* base = (char*)list->data;  

return base + (index * list->element_size);

}

// ========================================================
// SET
// ========================================================

void zen_list_set(
ZenList* list,
int index,
void* value
) {

if (index < 0 || index >= list->size) {
    fprintf(stderr, "\033[1;31m[Zen  IndexError]\n  └── Index %d is out of bounds for List of length %d — valid range is 0 to %d\033[0m\n", index, list->size, list->size - 1);
    exit(1);
}  

char* base = (char*)list->data;  

memcpy(  
    base + (index * list->element_size),  
    value,  
    list->element_size  
);

}

// ========================================================
// POP
// ========================================================

void zen_list_pop(
ZenList* list,
void* out
) {

if (list->size == 0) {
    fprintf(stderr, "\033[1;31m[Zen  IndexError]\n  └── Cannot pop from an empty List\033[0m\n");
    exit(1);
}  

char* base = (char*)list->data;  

memcpy(  
    out,  
    base + ((list->size - 1) * list->element_size),  
    list->element_size  
);  

list->size--;

}

// ========================================================
// REMOVE
// ========================================================

void zen_list_remove(
ZenList* list,
int index
) {

if (index < 0 || index >= list->size) {
    fprintf(stderr, "\033[1;31m[Zen  IndexError]\n  └── Index %d is out of bounds for List of length %d — valid range is 0 to %d\033[0m\n", index, list->size, list->size - 1);
    exit(1);
}  

char* base = (char*)list->data;  

memmove(  
    base + (index * list->element_size),  
    base + ((index + 1) * list->element_size),  
    (list->size - index - 1) * list->element_size  
);  

list->size--;

}

// ========================================================
// CLEAR
// ========================================================

void zen_list_clear(ZenList* list) {
list->size = 0;
}

// ========================================================
// FREE
// ========================================================

void zen_list_free(ZenList* list) {

if (list->data != NULL) {  
    free(list->data);  
}  

free(list);

}

// ========================================================
// CONTAINS (RAW MEMORY)
// ========================================================
/*
bool zen_list_contains(
ZenList* list,
void* value
) {

char* base = (char*)list->data;  

for (int i = 0; i < list->size; i++) {  

    void* current =  
        base + (i * list->element_size);  

    if (  
        memcmp(  
            current,  
            value,  
            list->element_size  
        ) == 0  
    ) {  
        return true;  
    }  
}  

return false;

}
*/


// ========================================================
// FORWARD DECL
// ========================================================
bool zen_list_contains(ZenList* list, void* value);
bool zen_list_deep_equals(ZenList* a, ZenList* b);

// ========================================================
// TYPE GUARD HELPERS (minimal runtime tagging assumption)
// ========================================================
// If element_size == sizeof(void*) we assume pointer type (nested list case)

static inline bool zen_is_pointer_type(ZenList* list) {
    return list->element_size == sizeof(void*);
}

// ========================================================
// CONTAINS (HYBRID)
// ========================================================

bool zen_list_contains(
    ZenList* list,
    void* value
) {

    if (!list || !list->data) {
        return false;
    }

    char* base = (char*)list->data;

    for (int i = 0; i < list->size; i++) {

        void* current =
            base + (i * list->element_size);

        // ================================
        // NESTED LIST CASE (DEEP COMPARE)
        // ================================
        if (zen_is_pointer_type(list)) {

            ZenList* a = *(ZenList**)current;
            ZenList* b = *(ZenList**)value;

            if (a == b) {
                return true; // same pointer fast path
            }

            if (a && b && zen_list_deep_equals(a, b)) {
                return true;
            }

        }
        // ================================
        // PRIMITIVE CASE (FAST MEMCMP)
        // ================================
        else {

            if (memcmp(
                current,
                value,
                list->element_size
            ) == 0) {
                return true;
            }
        }
    }

    return false;
}


bool zen_list_deep_equals(ZenList* a, ZenList* b) {

    if (a == b) return true;

    if (!a || !b) return false;

    if (a->size != b->size) return false;

    for (int i = 0; i < a->size; i++) {

        void* a_cur = (char*)a->data + i * a->element_size;
        void* b_cur = (char*)b->data + i * b->element_size;

        // =========================
        // RECURSIVE LIST CASE
        // =========================
        if (zen_is_pointer_type(a)) {

            ZenList* la = *(ZenList**)a_cur;
            ZenList* lb = *(ZenList**)b_cur;

            if (!zen_list_deep_equals(la, lb)) {
                return false;
            }

        }
        // =========================
        // PRIMITIVE CASE
        // =========================
        else {

            if (memcmp(
                a_cur,
                b_cur,
                a->element_size
            ) != 0) {
                return false;
            }
        }
    }

    return true;
}


// ========================================================
// VARARGS -> LIST
// ========================================================

ZenList* zen_va_ints(
    int count,
    va_list args
) {

    ZenList* list =
        zen_list_new(sizeof(int));

    for (int i = 0; i < count; i++) {

        int value =
            va_arg(args, int);

        zen_list_push(
            list,
            &value
        );
    }

    return list;
}

// ========================================================
// DOUBLE VARARGS
// ========================================================

ZenList* zen_va_doubles(
    int count,
    va_list args
) {

    ZenList* list =
        zen_list_new(sizeof(double));

    for (int i = 0; i < count; i++) {

        double value =
            va_arg(args, double);

        zen_list_push(
            list,
            &value
        );
    }

    return list;
}

// ========================================================
// STRING VARARGS
// ========================================================

ZenList* zen_va_strings(
    int count,
    va_list args
) {

    ZenList* list =
        zen_list_new(sizeof(char*));

    for (int i = 0; i < count; i++) {

        char* value =
            va_arg(args, char*);

        zen_list_push(
            list,
            &value
        );
    }

    return list;
}

// ========================================================
// BOOL VARARGS
// ========================================================

ZenList* zen_va_bools(
    int count,
    va_list args
) {

    ZenList* list =
        zen_list_new(sizeof(bool));

    for (int i = 0; i < count; i++) {

        int promoted =
            va_arg(args, int);

        bool value =
            promoted ? true : false;

        zen_list_push(
            list,
            &value
        );
    }

    return list;
}
