import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const commandInfoPath = "commands";

export function returnCompletionItemfromJSON(context: vscode.ExtensionContext, fileName: string) {
    let completeFilePath = path.join(context.extensionPath, commandInfoPath, `${fileName}.json`);
    let fileJson: any[] = [];
    
    // 安全读取：防止文件缺失导致插件加载崩溃
    try {
        const file = fs.readFileSync(completeFilePath, 'utf-8');
        fileJson = JSON.parse(file);
    } catch(err) {
        const e = err as Error;
        console.error(`Error reading or parsing ${fileName}.json: `, e.stack);
        return { "completion": [], "hover": {}, "signature": {} };
    }

    const name = "Command_Name";
    const description = "Description";
    const syntax = "Supported functions and syntax";
    const related = "Related commands";
    const functionType = "Type of function";
    const params = "Parameters";
    const example = "Example";
    const re = /\s/g;
    
    const completionArray: vscode.CompletionItem[] = [];
    const hoverDict: any = {};
    const signatureDict: any = {}; // 用于存放函数参数签名信息

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
        if (params in entry) { hasParams = true; }
        if (example in entry) { hasExample = true; }

        let detail: string = "";

        // 1. 组装顶部高亮语法块
        if ( hasType ) { 
            detail = detail + '(' + entry[functionType].toLowerCase().replace(re, "_") + ') ';
            rizhiyiCompletionItem.kind = vscode.CompletionItemKind.Method;
        }
        if ( hasSyntax ) { detail = detail + entry[syntax]; }
        else { detail = entry[name]; }
        
        if ( entry[functionType] === "Keyword" ) { rizhiyiCompletionItem.kind = vscode.CompletionItemKind.Keyword; }

        const detailMarkdown = new vscode.MarkdownString();
        // 清理正则：去除 JSON 中多余的转义反斜杠，防止 Markdown 渲染出奇怪的斜杠
        const cleanDetail = detail.replace(/\\([<>\[\]])/g, '$1'); 
        detailMarkdown.appendCodeblock(cleanDetail, 'rizhiyi_spl'); 

        // 2. 组装高级美化版 Markdown 文档
        const documentation = new vscode.MarkdownString();
        documentation.supportThemeIcons = true; 
        documentation.isTrusted = true;
        documentation.appendMarkdown(`$(info) **命令说明**\n\n${entry[description]}\n\n`);

        // =========================================================================
        // 3. 全新逻辑：通过解析 "Supported functions and syntax" 提取参数以支持 Signature Help
        // =========================================================================
        if ( hasSyntax ) {
            const syntaxStr = entry[syntax] as string; // 例如: "if(X,Y,Z)" 或 "log(X [,Y])"
            
            // 使用正则提取括号内部的内容
            // 匹配类似 "func_name(参数内容)" 中的 "参数内容"
            const paramMatch = syntaxStr.match(/^[^(]+\((.*)\)/);

            if (paramMatch) {
                const innerParamsStr = paramMatch[1].trim();
                
                // 注册给 VS Code 的函数签名结构，Label直接使用整个语法字符串 (如 if(X,Y,Z))
                const signatureInfo = new vscode.SignatureInformation(syntaxStr, new vscode.MarkdownString(entry[description]));
                const sigParams: vscode.ParameterInformation[] = [];

                if (innerParamsStr.length > 0) {
                    // 如果括号里有内容，按逗号切分出每个参数 (例如 "X", "Y", "Z")
                    const rawParams = innerParamsStr.split(',');
                    
                    documentation.appendMarkdown(`---\n$(list-selection) **参数说明**\n\n`);

                    for (let p of rawParams) {
                        p = p.trim(); // 去除多余空格
                        
                        // 生成 Markdown 列表展示
                        if (p.includes('[')) {
                            documentation.appendMarkdown(`* ⚪ \`${p}\` *(可选参数)*\n`);
                        } else {
                            documentation.appendMarkdown(`* 🔵 \`${p}\` *(必选参数)*\n`);
                        }

                        // 将参数放入签名列表中供 VS Code 高亮
                        sigParams.push(new vscode.ParameterInformation(p));
                    }
                    documentation.appendMarkdown(`\n`);
                }

                // 绑定参数到签名并存入字典
                signatureInfo.parameters = sigParams;
                signatureDict[entry[name]] = signatureInfo;
            }
        }
        
        // 4. 处理相关示例 (也使用原生高亮渲染)
        if ( hasExample ) { 
            documentation.appendMarkdown(`---\n$(lightbulb) **相关示例**\n\n`);
            const cleanExample = entry[example].replace(/\\([<>\[\]])/g, '$1'); 
            documentation.appendCodeblock(cleanExample, 'rizhiyi_spl');
        }

        rizhiyiCompletionItem.detail = detail;
        rizhiyiCompletionItem.documentation = documentation;

        // 5. 智能片段插入 (Snippet) 逻辑
        if (entry[name] === 'stats') {
            // 输入 stats 回车后，自动补全基础骨架
            rizhiyiCompletionItem.insertText = new vscode.SnippetString('stats ${1:count(field)} by ${2:field}');
        } else if (hasType && (entry[functionType] === 'Eval Function' || entry[functionType] === 'Stats Function')) {
            // 输入 eval/stats 函数名回车后，自动加上括号，光标落于括号内
            rizhiyiCompletionItem.insertText = new vscode.SnippetString(`${entry[name]}(\${1})`);
        } else {
            rizhiyiCompletionItem.insertText = entry[name];
        }

        let rizhiyiHoverItem = new vscode.Hover([detailMarkdown, documentation]);
        
        completionArray.push(rizhiyiCompletionItem);
        hoverDict[entry[name]] = rizhiyiHoverItem;
    }
    
    return {
        "completion": completionArray,
        "hover": hoverDict,
        "signature": signatureDict
    };
}

export function activate(context: vscode.ExtensionContext) {
    let rizhiyiSelector: vscode.DocumentSelector = {
        language: 'rizhiyi_spl'
    };
    
    // 初始化解析各个 JSON 文件
    let mainFunctions = returnCompletionItemfromJSON(context, 'CommandDescriptionList');
    let evalFunctions = returnCompletionItemfromJSON(context, 'EvalFunctionSyntaxDescription');
    let statsFunctions = returnCompletionItemfromJSON(context, 'StatsFunctionSyntaxDescription');
    let operators = returnCompletionItemfromJSON(context, 'OperatorsSyntaxDescription');

    // 汇总各种资源字典
    const allHovers = {
        ...mainFunctions['hover'], 
        ...evalFunctions['hover'], 
        ...statsFunctions['hover'], 
        ...operators['hover']
    };

    const mainCompletions = mainFunctions['completion'];
    const evalCompletions = evalFunctions['completion'];
    const statsCompletions = statsFunctions['completion'];
    const operatorCompletions = operators['completion'];

    const allSignatures = { 
        ...evalFunctions['signature'], 
        ...statsFunctions['signature'] 
    };

    // 注册 Hover 悬停提示
    let rizhiyiHoverProvider = vscode.languages.registerHoverProvider(rizhiyiSelector, {
        provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) {
            const rizhiyiRange = document.getWordRangeAtPosition(position);
            if (!rizhiyiRange) {
                return undefined;
            }
            const hoverWord = document.getText(rizhiyiRange);
            if (!(hoverWord in allHovers)) {
                return undefined;
            }
            return allHovers[hoverWord];
        }
    });
    
    // 注册智能代码补全 (区分上下文场景)
    let rizhiyiCompletionProvider = vscode.languages.registerCompletionItemProvider(
        rizhiyiSelector,
        {
            provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
                const linePrefix = document.lineAt(position).text.substr(0, position.character);
                
                // 场景A: 刚敲完管道符，推荐主命令
                if (linePrefix.match(/\|\s*$/)) {
                    return mainCompletions;
                }
                // 场景B: 在 stats 语句中，推荐 stats 函数
                if (linePrefix.match(/\bstats\s+.*$/i)) {
                    return statsCompletions;
                }
                // 场景C: 在 eval 语句中，推荐 eval 函数
                if (linePrefix.match(/\beval\s+.*$/i)) {
                    return evalCompletions;
                }
                // 默认返回全部聚合
                return [...mainCompletions, ...evalCompletions, ...statsCompletions, ...operatorCompletions];
            }
        },
        '|', ' ' // 触发补全的快捷字符
    );

    // 注册函数参数签名提示 (究极智能)
    let rizhiyiSignatureProvider = vscode.languages.registerSignatureHelpProvider(
        rizhiyiSelector,
        {
            provideSignatureHelp(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) {
                const linePrefix = document.lineAt(position).text.substring(0, position.character);
                // 正则反向查找光标当前所处的函数名
                const match = linePrefix.match(/(\w+)\s*\([^()]*$/);
                
                if (!match) return undefined;

                const funcName = match[1];
                if (!(funcName in allSignatures)) return undefined;

                const signatureHelp = new vscode.SignatureHelp();
                signatureHelp.signatures = [allSignatures[funcName]];
                signatureHelp.activeSignature = 0;

                // 计算当前处于第几个参数（通过数逗号判断）
                const argsString = linePrefix.substring(match.index! + match[1].length + 1);
                const commasCount = (argsString.match(/,/g) || []).length;
                
                signatureHelp.activeParameter = commasCount; 

                return signatureHelp;
            }
        },
        '(', ',' // 触发提示的按键
    );

    // 注册 SPL 格式化命令
    let rizhiyiCommandProvider = vscode.commands.registerCommand('rizhiyi_spl.Prettify', function() {
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

    // 挂载所有 Provider
    context.subscriptions.push(
        rizhiyiCommandProvider,
        rizhiyiHoverProvider,
        rizhiyiCompletionProvider,
        rizhiyiSignatureProvider
    );    
}

export function deactivate() {}

// 优化后的格式化引擎 (支持字符串跳过)
function formatText(text: string): string {
    let result: string[] = [];
    let indentLevel: number = 0;
    let i: number = 0;5
    let inQuote: boolean = false; 
    
    text = text.replace(/\s*\s\[/g, ' [');
    text = text.replace(/\[\s{0,}\n\s*/g, '[');
    text = text.replace(/\|\s+(\w+)/g, '|$1');
    text = text.replace(/(append|join)(\[)/g, '$1 $2');
    
    while (i < text.length) {
        // 判断是否在字符串引号内部
        if (text[i] === '"' && (i === 0 || text[i - 1] !== '\\')) {
            inQuote = !inQuote;
            result.push(text[i]);
            i += 1;
            continue;
        }

        // 仅在非引号内部执行管道符换行与缩进逻辑
        if (!inQuote) {
            if (text.slice(i, i + 2) === '[[') {
                result.push('[[');
                indentLevel++;
                i += 2;
                result.push('\n' + ' '.repeat(indentLevel * 4));
                continue;
            } else if (text.slice(i, i + 2) === ']]') {
                indentLevel--;
                trimTrailingEmptyLines(result);
                result.push('\n' + ' '.repeat(indentLevel * 4) + ']]');
                i += 2;
                continue;
            } else if (text.slice(i, i + 2) === '||') {
                result.push('||');
                i += 2;
                continue;
            } else if (text[i] === '|') {
                trimTrailingEmptyLines(result);
                result.push('\n' + ' '.repeat(indentLevel * 4) + '|');
                i += 1;
                continue;
            } else if (text.slice(i, i + 2) === '${' && text.indexOf('}', i) > i) {
                let endVar = text.indexOf('}', i) + 1;
                result.push(' '.repeat(indentLevel * 4) + text.slice(i, endVar));
                i = endVar;
                continue;
            }
        }
        
        result.push(text[i]);
        i += 1;
    }

    return result.join('');
}

function trimTrailingEmptyLines(result: string[]): void {
    while (result.length > 0 && result[result.length - 1].trim() === '') {
        result.pop();
    }
}