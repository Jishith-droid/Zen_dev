// =====================================================
// ZEN MAP RUNTIME
// =====================================================

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h> 
// =====================================================
// HELPERS
// =====================================================

#define INITIAL_CAPACITY 8

// optional helper macros
#define INT2PTR(x) ((void*)(long)(x))
#define PTR2INT(x) ((int)(long)(x))

// =====================================================
// MAP ENTRY
// =====================================================

typedef struct {

    char* key;
    void* value;
} MapEntry;

// =====================================================
// MAP
// =====================================================

typedef struct {

    MapEntry* entries;

    int count;
    int capacity;

} ZenMap;

// =====================================================
// CREATE MAP
// =====================================================

ZenMap* zen_map_new() {

    ZenMap* map =
        malloc(sizeof(ZenMap));

    map->count = 0;
    map->capacity = INITIAL_CAPACITY;

    map->entries =
        calloc(
            map->capacity,
            sizeof(MapEntry)
        );

    return map;
}

// =====================================================
// INTERNAL RESIZE
// =====================================================

void zen_map_resize(ZenMap* map) {

    map->capacity *= 2;

    map->entries =
        realloc(
            map->entries,
            sizeof(MapEntry) * map->capacity
        );

   if (!map->entries) {
    fprintf(stderr, "\033[1;31m[Zen  MemoryError]\n  └── Failed to allocate memory for Map — realloc failed\033[0m\n");
    exit(1);
}
}

// =====================================================
// SET
// =====================================================

void zen_map_set(ZenMap* map, char* key, void* value, int type) {

    for (int i = 0; i < map->count; i++) {

        if (strcmp(map->entries[i].key, key) == 0) {

            map->entries[i].value = value;
         

            return;
        }
    }

    if (map->count >= map->capacity) {
        zen_map_resize(map);
    }

    map->entries[map->count].key = strdup(key);
    map->entries[map->count].value = value;

    map->count++;
}

// =====================================================
// GET
// =====================================================

void* zen_map_get(
    ZenMap* map,
    char* key
) {

    for (int i = 0; i < map->count; i++) {

        if (
            strcmp(
                map->entries[i].key,
                key
            ) == 0
        ) {

            return map->entries[i].value;
        }
    }

    fprintf(stderr, "\033[1;31m[Zen  ReferenceError]\n  └── Key '%s' is not defined in Map\033[0m\n", key);
exit(1);
}

// =====================================================
// HAS
// =====================================================

bool zen_map_has(
    ZenMap* map,
    char* key
) {
    for (int i = 0; i < map->count; i++) {
        if (strcmp(map->entries[i].key, key) == 0) {
            return true;
        }
    }
    return false;
}

// =====================================================
// REMOVE
// =====================================================

void zen_map_remove(
    ZenMap* map,
    char* key
) {

    for (int i = 0; i < map->count; i++) {

        if (
            strcmp(
                map->entries[i].key,
                key
            ) == 0
        ) {

            free(
                map->entries[i].key
            );

            // shift left
            for (
                int j = i;
                j < map->count - 1;
                j++
            ) {

                map->entries[j] =
                    map->entries[j + 1];
            }

            map->count--;

            return;
        }
    }
}

// =====================================================
// FREE
// =====================================================

void zen_map_free(
    ZenMap* map
) {

    for (int i = 0; i < map->count; i++) {

        free(
            map->entries[i].key
        );
    }

    free(map->entries);

    free(map);
}
