// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// ======================= COMMAND ITEMS ======================== //
	
	let rizhiyiCommandProvider = returnCommandRegister(context);

	context.subscriptions.push(rizhiyiCommandProvider);
}

// This method is called when your extension is deactivated
export function deactivate() {}


function testNewline(docText: string, position: number) {
    for (position; position > 0; position--) {
        if (docText[position] === " " || docText[position] === "\t" || docText[position] === "[") {
            continue;
        }
        else if (docText[position] === "\n" || docText[position] === "\r") {
            return true;
        }
        else {
            return false;
        }
    }
}

function getMainCommand(docText: string, position: number) {
    //assuming we trigger this on every pipe or open bracket, we can assume
    // the next word is a command
    let word: string = '';
    for (position; position > 0; position++) {
        if ((docText[position] === " " || docText[position] === "\t" || docText[position] === "[" || docText[position] === "|") && word === "") {
            continue;
        }
        else if (docText[position]) {
            
        }
    }
}

export function returnCommandRegister(context: vscode.ExtensionContext) {
    const rizhiyiCommandHandler = vscode.commands.registerCommand('rizhiyi_spl.Prettify', function() {
        let editor = vscode.window.activeTextEditor;
        if (editor) {
            console.log("editor is active");
            let document = editor.document;
            
            //docText is actual string we're going to return, docTextCopy is 
            // a copy to iterate through that doesn't change
            let docText: string = document.getText();
            let docTextCopy: string = docText;

            // define new vars:
            // keep track of position in docText
            let i: number = 0; 

            // keep track of whether or not we're going to skip a pipe
            let inBaseBracket: boolean = false;

            // keep track of wheter or not we're in a quote
            let inQuote: boolean = false;

            // keep track of what level we're at in brackets
            let bracketLevel = 0;

            // keep track of what global rizhiyi command we're in 
            for (const character of docTextCopy) {
                if (i === 0) { i++; continue; }
                if (inBaseBracket) {
                    if (character === '|') {
                        inBaseBracket = false;
                        i++;
                        continue;
                    }
                    else if (character === ' ') {
                        i++;
                        continue;
                    }
                    else {
                        inBaseBracket = false;
                        i++;
                        continue;
                    }
                }
                else if (character === "\"") {
                    // if quote is escaped, it doesn't matter
                    if (docText[i-1] === "\\") {
                        i++;
                        continue;
                    }
                    if (inQuote) {
                        inQuote = false;
                        i++;
                        continue;
                    }
                    else {
                        inQuote = true;
                        i++;
                        continue;
                    }
                }
                else if (character === "[") {
                    console.log("open bracket found");
                    if (docText[i-1] === "\\" || inQuote) {
                        console.log("we're either escaping or in a quote");
                        i++;
                        continue;
                    }
                    if (testNewline(docText, i-1)) {
                        console.log("found newline with function");
                        i++;
                        continue;
                    }
                    let lengthToIncrease: number = 2;
                    let insertString: string = '\n';
                    
                    // insert string increases indent per bracketLevel
                    bracketLevel++;
                    for (var x = 0; x < bracketLevel; x++) { insertString = insertString + '  '; lengthToIncrease += 2; }
                    docText = docText.slice(0, i) + insertString + docText.slice(i);
                    inBaseBracket = true;
                    i += lengthToIncrease;
                }
                else if (character === "]") {
                    console.log("close bracket found");
                    if (docText[i-1] === "\\" || inQuote) {
                        console.log("we're either escaping or in a quote");
                        i++;
                        continue;
                    }
                    let lengthToIncrease: number = 1;
                    
                    let insertString: string = '';
                    // make sure bracketLevel is decreased before adding in \t
                    bracketLevel--;
                    for (var y = 0; y < bracketLevel; y++) { insertString = insertString + '  '; lengthToIncrease += 2; }
                    docText = docText.slice(0, i + 1) + insertString + docText.slice(i + 1);
                    i += lengthToIncrease;
                }
                else if (character === '|') {
                    console.log("Pipe found");
                    if (docText[i-1] === "\\" || inQuote) {
                        console.log("we're either escaping or in a quote");
                        i++;
                        continue;
                    }
                    if (testNewline(docText, i-1)) {
                        console.log("found newline with function");
                        i++;
                        continue;
                    }
                    /* if (docText[i] === "\n" || docText[i - 1] === "\n" || docText[i - 2] === "\n") {
                        i++;
                        console.log("found newline; leaving it alone");
                        continue;
                    } */
                    let lengthToIncrease: number = 2;
                    let insertString: string = '\n';
                    
                    // insert string increases indent per bracketLevel
                    for (var z = 0; z < bracketLevel; z++) { insertString = insertString + '  '; lengthToIncrease += 2; }
                    docText = docText.slice(0, i) + insertString + docText.slice(i);
                    i += lengthToIncrease;
                }
                else {
                    i++;
                }
            }
            
            editor.edit(editBuilder => {
                let numLines: number = document.lineCount;
                console.log(numLines);
                let range: vscode.Range = new vscode.Range(0, 0, numLines, document.lineAt(numLines - 1).text.length);
                editBuilder.replace(range, docText);
                console.log("replaced");
            });
        }
    });

    return rizhiyiCommandHandler;
}