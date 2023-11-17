# README

This extension suggests full table names intellisense (including schema)

# Building vsix package

To build this extension you need to install

```npm i @vscode/vsce```

Then to generate a vsix package run 

```vsce package```

# Debug

Debug is available from VS Code, you have to install this extension https://marketplace.visualstudio.com/items?itemName=ms-mssql.sqlops-debug

Be sure to run ```npm run watch``` 
to compile the extension source code before debugging (it should run automatically on debug task)

Then run a debug task from Vs Code (press F5), it will start the instance of Azure Data Studio with compiled version of the extension.


