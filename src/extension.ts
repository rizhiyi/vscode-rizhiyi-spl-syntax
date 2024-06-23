import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    let rizhiyiCommandProvider = returnCommandRegister(context);
    context.subscriptions.push(rizhiyiCommandProvider);
}

export function deactivate() {}

function returnCommandRegister(context: vscode.ExtensionContext) {
    const rizhiyiCommandHandler = vscode.commands.registerCommand('rizhiyi_spl.Prettify', function() {
        let editor = vscode.window.activeTextEditor;
        if (editor) {
            let document = editor.document;
            let docText: string = document.getText();
            let formattedText: string = formatText(docText);
            
            editor.edit(editBuilder => {
                let numLines: number = document.lineCount;
                let range: vscode.Range = new vscode.Range(0, 0, numLines, document.lineAt(numLines - 1).text.length);
                editBuilder.replace(range, formattedText);
            });
        }
    });

    return rizhiyiCommandHandler;
}

function formatText(text: string): string {
    let result: string[] = [];
    let indentLevel: number = 0;
    let i: number = 0;
    let inQuote: boolean = false;

    while (i < text.length) {
        if (text.slice(i, i + 2) === '[[') {
            result.push('[[');
            indentLevel++;
            i += 2;
            result.push('\n' + ' '.repeat(indentLevel * 4));
        } else if (text.slice(i, i + 2) === ']]') {
            indentLevel--;
            trimTrailingEmptyLines(result);
            result.push('\n' + ' '.repeat(indentLevel * 4) + ']]');
            i += 2;
        } else if (text.slice(i, i + 2) === '||') {
            result.push('||');
            i += 2;
        } else if (text[i] === '|') {
            trimTrailingEmptyLines(result);
            result.push('\n' + ' '.repeat(indentLevel * 4) + '|');
            i += 1;
        } else if (text.slice(i, i + 2) === '${' && text.indexOf('}', i) > i) {
            let endVar = text.indexOf('}', i) + 1;
            result.push('\n' + ' '.repeat(indentLevel * 4) + text.slice(i, endVar));
            i = endVar;
        } else {
            result.push(text[i]);
            i += 1;
        }
    }

    return result.join('');
}

function trimTrailingEmptyLines(result: string[]): void {
    while (result.length > 0 && result[result.length - 1].trim() === '') {
        result.pop();
    }
}
