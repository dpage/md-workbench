//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

// Electron can only create security-scoped bookmarks from an Open or Save
// dialog. This creates one for any path the sandbox currently lets the app
// access, such as a file opened from Finder, using the same options and
// encoding as Electron so the result works with
// app.startAccessingSecurityScopedResource().

#import <Foundation/Foundation.h>
#include <node_api.h>
#include <string>

static napi_value CreateSecurityScopedBookmark(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1];
  napi_value result;
  napi_get_null(env, &result);

  size_t length;
  if (napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr) != napi_ok || argc < 1 ||
      napi_get_value_string_utf8(env, argv[0], nullptr, 0, &length) != napi_ok) {
    napi_throw_type_error(env, nullptr, "Expected a path");
    return nullptr;
  }
  std::string filePath(length, '\0');
  napi_get_value_string_utf8(env, argv[0], &filePath[0], length + 1, &length);

  @autoreleasepool {
    NSString *path = [[[NSString alloc] initWithBytes:filePath.data()
                                               length:filePath.size()
                                             encoding:NSUTF8StringEncoding] autorelease];
    if (path == nil) return result;

    NSError *error = nil;
    NSData *bookmark = [[NSURL fileURLWithPath:path]
                 bookmarkDataWithOptions:NSURLBookmarkCreationWithSecurityScope
          includingResourceValuesForKeys:nil
                           relativeToURL:nil
                                   error:&error];
    if (bookmark == nil) return result;

    NSString *encoded = [bookmark base64EncodedStringWithOptions:0];
    napi_create_string_utf8(env, [encoded UTF8String], NAPI_AUTO_LENGTH, &result);
  }

  return result;
}

static napi_value Init(napi_env env, napi_value exports) {
  napi_value fn;
  napi_create_function(env, "createSecurityScopedBookmark", NAPI_AUTO_LENGTH,
                       CreateSecurityScopedBookmark, nullptr, &fn);
  napi_set_named_property(env, exports, "createSecurityScopedBookmark", fn);
  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
