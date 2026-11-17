# Office TV browser

The TV displays a real embedded web page. Approach it and press E to open browser controls: address, refresh, phone/desktop viewport, SOBR shortcut, and a separate browser tab. The default preview is the Office hostname on port 8081; run the web development server there or enter another URL. The address is saved per browser, not broadcast to other users. Screen sharing remains separate.

Only HTTP/HTTPS addresses without embedded credentials are accepted. The iframe is sandboxed; websites can still prohibit embedding with CSP or X-Frame-Options. Use New tab for those sites. HTTPS Office pages cannot embed insecure HTTP previews. Closing the browser reloads its view on the TV; iframe navigation inside the app is not reflected in the address bar. The close button always works; Escape works while focus is in Office, but a cross-origin embedded app handles its own keyboard events.

This is a browser viewport projected onto the TV, not a screenshot of the user's desktop. Visibility checks hide it behind walls. Web app functionality and login are supplied by the embedded site itself.
