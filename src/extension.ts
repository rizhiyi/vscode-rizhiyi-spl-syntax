import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const commandInfoPath = "commands";

export function returnCompletionItemfromJSON(context: vscode.ExtensionContext, fileName: string) {
    let completeFilePath = path.join(context.extensionPath, commandInfoPath, `${fileName}.json`);
    let file: string;
    file = fs.readFileSync(completeFilePath, 'utf-8');
    try {
        file = fs.readFileSync(completeFilePath, 'utf-8');
    } catch(err) {
        const e = err as Error;
        console.log("Error: ", e.stack);
    }

    const fileJson = JSON.parse(file);
    const name = "Command_Name";
    const description = "Description";
    const syntax = "Supported functions and syntax";
    const related = "Related commands";
    const functionType = "Type of function";
    const params = "Parameters";
    const example = "Example";
    const re = /\s/g;
    const completionArray = [];
    const hoverDict: any = {};
    
    for (const entry of fileJson) {
        const rizhiyiCompletionItem = new vscode.CompletionItem(entry[name]);
        rizhiyiCompletionItem.kind = vscode.CompletionItemKind.Keyword;
        rizhiyiCompletionItem.commitCharacters = ['\t'];

        let hasSyntax: boolean = false;
        let hasParams: boolean = false;
        let hasType: boolean = false;
        let hasRelated: boolean = false;
        let hasExample: boolean = false;
        if (functionType in entry) { hasType = true; }
        if (syntax in entry) { hasSyntax = true; }
        if (related in entry) { hasRelated = true; }
        if (params in entry) {hasParams = true; }
        if (example in entry) {hasExample = true; }

        let detail: string = "";
        let documentation = entry[description];
        let docString: string = "";

         if ( hasParams ) {
            rizhiyiCompletionItem.kind = vscode.CompletionItemKind.Class;
            const requiredParams = entry['Parameters']['Required'];
            const optionalParams = entry['Parameters']['Optional'];

            if (requiredParams) {
                docString = docString + "\n#### 必选参数:";
                for (const i in requiredParams) {
                    docString = docString + "\n_@param_ `" + i + "`  \n  \n" + requiredParams[i] + "  \n  \n";
                }
            }

            if (optionalParams) {
                docString = docString + "\n#### 可选参数: \n";
                for (const i in optionalParams) {
                    docString = docString + "\n_@param_ `" + i + "`  \n  \n" + optionalParams[i] + "  \n  \n";
                }
            }
        }
        // if ( hasRelated ) { 
        //     documentation = new vscode.MarkdownString(documentation + docString + "\n#### 相关命令:\n" + entry[related]);
        // }
        if ( hasExample ) { 
            documentation = new vscode.MarkdownString(documentation + docString + "\n#### 相关示例:\n" + entry[example]);
        }
        if ( hasType ) { 
            detail = detail + '(' + entry[functionType].toLowerCase().replace(re, "_") + ') ';
            rizhiyiCompletionItem.kind = vscode.CompletionItemKind.Method;
        }
        if ( hasSyntax ) { detail = detail + entry[syntax]; }
        else { detail = entry[name]; }
        
        if ( entry[functionType] === "Keyword" ) { rizhiyiCompletionItem.kind = vscode.CompletionItemKind.Keyword; }


        rizhiyiCompletionItem.detail = detail;
        rizhiyiCompletionItem.documentation = documentation;

        let rizhiyiHoverItem = new vscode.Hover(entry[name]);
        rizhiyiHoverItem.contents = [new vscode.MarkdownString(detail), documentation];
        completionArray.push(rizhiyiCompletionItem);
        hoverDict[entry[name]] = rizhiyiHoverItem;
    }
    return {
        "completion": completionArray,
        "hover": hoverDict
    };
}

export function activate(context: vscode.ExtensionContext) {
	let rizhiyiSelector:vscode.DocumentSelector = {
		// scheme: 'file',
		language: 'rizhiyi_spl'
	};
	let mainFunctions = returnCompletionItemfromJSON(context, 'CommandDescriptionList');
	const mainHovers = mainFunctions['hover'];
	let evalFunctions = returnCompletionItemfromJSON(context, 'EvalFunctionSyntaxDescription');
	const evalHovers = evalFunctions['hover'];
	let statsFunctions = returnCompletionItemfromJSON(context, 'StatsFunctionSyntaxDescription');
	const statsHovers = statsFunctions['hover'];
	let operators = returnCompletionItemfromJSON(context, 'OperatorsSyntaxDescription');
	const operatorsHovers = operators['hover'];
	const allHovers = {...mainHovers, ...evalHovers, ...statsHovers, ...operatorsHovers};


    console.log("Providing hover items");
    let rizhiyiHoverProvider = vscode.languages.registerHoverProvider(rizhiyiSelector, {
        provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) {
            const rizhiyiRange = document.getWordRangeAtPosition(position);
            const hoverWord = document.getText(rizhiyiRange);
            
            if (!(hoverWord in allHovers)) {
                return undefined;
            }
            return allHovers[hoverWord];
        }
    });
    
    let rizhiyiCommandProvider =  vscode.commands.registerCommand('rizhiyi_spl.Prettify', function() {
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

    context.subscriptions.push(
        rizhiyiCommandProvider,
        rizhiyiHoverProvider
    );    
}

export function deactivate() {}

function formatText(text: string): string {
    let result: string[] = [];
    let indentLevel: number = 0;
    let i: number = 0;
    let inQuote: boolean = false;
    text = text.replace(/\s*\s\[/g, ' [');
    text = text.replace(/\[\s{0,}\n\s*/g, '[');
    text = text.replace(/\|\s+(\w+)/g, '|$1');
    text = text.replace(/(append|join)(\[)/g, '$1 $2');
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
            result.push(' '.repeat(indentLevel * 4) + text.slice(i, endVar));
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