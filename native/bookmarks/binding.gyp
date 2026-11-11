{
  "targets": [
    {
      "target_name": "bookmarks",
      "conditions": [
        ["OS=='mac'", {
          "sources": ["src/bookmarks.mm"],
          "link_settings": {
            "libraries": ["-framework Foundation"]
          },
          "xcode_settings": {
            "MACOSX_DEPLOYMENT_TARGET": "12.0"
          }
        }, {
          "type": "none"
        }]
      ]
    }
  ]
}
