export interface ParsedComponent {
  type: string;
  component: string;
  props: Record<string, any>;
  children?: (ParsedComponent | string)[];
}

export interface ParseResult {
  success: boolean;
  components: ParsedComponent[];
  error?: string;
  dataType?: string;
  debugInfo?: string;
}

export interface IndexedParseResult extends ParseResult {
  index: number;
  snippetPreview: string;
}

export interface AggregatedParseResult {
  totalScripts: number;
  successCount: number;
  failureCount: number;
  moduleLoadingCount: number;
  results: IndexedParseResult[];
  combinedComponents: ParsedComponent[];
}

export class NextJSScriptParser {
  parseScriptContent(scriptContent: string): ParsedComponent[] {
    const result = this.parseScriptContentDetailed(scriptContent);

    if (!result.success) {
      console.error('Parse failed:', result.error);
      if (result.debugInfo) {
        console.log('Debug info:', result.debugInfo);
      }
    }

    return result.components;
  }

  parseDocumentContent(content: string): AggregatedParseResult {
    const pushCalls = this.extractPushCalls(content);

    if (pushCalls.length === 0) {
      return {
        totalScripts: 0,
        successCount: 0,
        failureCount: 0,
        moduleLoadingCount: 0,
        results: [],
        combinedComponents: []
      };
    }

    const combinedComponents: ParsedComponent[] = [];
    const results: IndexedParseResult[] = [];

    pushCalls.forEach((snippet, index) => {
      const parseResult = this.parseScriptContentDetailed(snippet);
      const snippetPreview = snippet.replace(/\s+/g, ' ').substring(0, 120);

      if (parseResult.success) {
        combinedComponents.push(...parseResult.components);
      }

      results.push({
        ...parseResult,
        index,
        snippetPreview
      });
    });

    const successCount = results.filter(result => result.success && result.dataType === 'component-data').length;
    const moduleLoadingCount = results.filter(result => result.dataType === 'module-loading').length;
    const failureCount = results.filter(result => !result.success).length;

    return {
      totalScripts: results.length,
      successCount,
      failureCount,
      moduleLoadingCount,
      results,
      combinedComponents
    };
  }

  parseScriptContentDetailed(scriptContent: string): ParseResult {
    try {
      console.log('Starting parse of script content...');

      // Step 1: Extract data from script
      const cleanContent = this.extractDataFromScript(scriptContent);
      console.log('Extracted content:', cleanContent.substring(0, 200) + '...');

      // Step 2: Parse as JSON
      const parsedData = JSON.parse(cleanContent);
      console.log('Parsed JSON structure:', Array.isArray(parsedData) ? 'Array' : typeof parsedData, 'Length:', Array.isArray(parsedData) ? parsedData.length : 'N/A');

      if (!Array.isArray(parsedData) || parsedData.length < 2) {
        return {
          success: false,
          components: [],
          error: 'Invalid data structure: Expected array with at least 2 elements',
          debugInfo: `Got: ${JSON.stringify(parsedData).substring(0, 100)}...`
        };
      }

      // Step 3: Extract component data
      let componentData = parsedData[1];
      console.log('Component data type:', typeof componentData);

      if (typeof componentData === 'string') {
        console.log('Component data preview:', componentData.substring(0, 100) + '...');

        // Detect data type
        const dataType = this.detectDataType(componentData);
        console.log('Detected data type:', dataType);

        if (dataType === 'module-loading') {
          return {
            success: true,
            components: [],
            dataType: 'module-loading',
            debugInfo: `Data starts with: ${componentData.substring(0, 50)}...`
          };
        }

        if (dataType === 'component-data' && componentData.includes(':')) {
          const colonIndex = componentData.indexOf(':');
          const dataAfterColon = componentData.substring(colonIndex + 1);
          console.log('Extracting after colon:', dataAfterColon.substring(0, 100) + '...');
          try {
            componentData = JSON.parse(dataAfterColon);
          } catch (parseError) {
            console.error('Failed to parse component data after colon:', parseError);
            return {
              success: false,
              components: [],
              error: 'Failed to parse component data structure',
              debugInfo: `Parse error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
            };
          }
        } else if (dataType === 'component-data') {
          // Handle case where data might already be parsed or doesn't need colon extraction
          try {
            if (typeof componentData === 'string') {
              componentData = JSON.parse(componentData);
            }
          } catch (parseError) {
            console.log('Component data is already in correct format or not JSON string');
          }
        }
      }

      // Step 4: Parse component structure
      const components = this.parseComponentStructure(componentData);
      console.log('Successfully parsed', components.length, 'components');

      return {
        success: true,
        components,
        dataType: 'component-data'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Parse error:', errorMessage);

      return {
        success: false,
        components: [],
        error: `Parse failed: ${errorMessage}`,
        debugInfo: `Input length: ${scriptContent.length}, Error at parsing stage`
      };
    }
  }

  private detectDataType(data: string): 'component-data' | 'module-loading' | 'unknown' {
    // Module loading data typically starts with patterns like "1f:", "1e:", etc.
    // and contains file paths
    if (/^[0-9a-f]+:I\[/.test(data) || data.includes('static/chunks/')) {
      return 'module-loading';
    }

    // Component data typically starts with a key (numeric or alphanumeric) followed by serialized data
    if (/^[0-9a-z]+:\[/i.test(data)) {
      return 'component-data';
    }

    return 'unknown';
  }

  private extractDataFromScript(scriptContent: string): string {
    // Find the pattern and manually extract the balanced brackets
    const prefix = 'self.__next_f.push([';
    const suffix = '])';

    const startIndex = scriptContent.indexOf(prefix);
    if (startIndex === -1) {
      throw new Error('Invalid Next.js script format');
    }

    const contentStart = startIndex + prefix.length;
    const contentEnd = scriptContent.lastIndexOf(suffix);

    if (contentEnd === -1 || contentEnd <= contentStart) {
      throw new Error('Invalid Next.js script format - mismatched brackets');
    }

    let content = `[${scriptContent.substring(contentStart, contentEnd)}]`;

    // Clean up trailing escaped newlines without stripping closing quotes
    content = content.replace(/\\n(?="\]$)/, '');
    content = content.replace(/\\n$/, '');

    try {
      const result = JSON.parse(content);
      return JSON.stringify(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('JSON parse error:', message);
      console.error('Content preview:', content.substring(0, 100) + '...');
      console.error('Content ending:', content.slice(-50));
      throw new Error(`Unable to parse script content as JSON: ${message}`);
    }
  }

  private parseComponentStructure(data: any): ParsedComponent[] {
    if (typeof data === 'string') {
      return [{ type: 'text', component: 'text', props: { content: data } }];
    }

    if (!Array.isArray(data)) {
      return [];
    }

    if (data.length > 0 && data[0] === '$') {
      const parsed = this.parseComponent(data);
      return parsed ? [parsed] : [];
    }

    const results: ParsedComponent[] = [];

    for (const item of data) {
      if (typeof item === 'string') {
        results.push({ type: 'text', component: 'text', props: { content: item } });
      } else if (Array.isArray(item)) {
        const parsed = this.parseComponent(item);
        if (parsed) {
          results.push(parsed);
        } else {
          // If it's not a component, it might be nested structure
          const nestedResults = this.parseComponentStructure(item);
          results.push(...nestedResults);
        }
      }
    }

    return results;
  }

  private parseComponent(componentArray: any[]): ParsedComponent | null {
    if (componentArray.length < 3 || componentArray[0] !== '$') {
      return null;
    }

    const componentType = componentArray[1];
    const props = componentArray[3] || {};

    const result: ParsedComponent = {
      type: 'component',
      component: componentType,
      props: { ...props }
    };

    if (props.children) {
      result.children = this.parseChildren(props.children);
      delete result.props.children;
    }

    return result;
  }

  private parseChildren(children: any): (ParsedComponent | string)[] {
    if (typeof children === 'string') {
      return [children];
    }

    if (!Array.isArray(children)) {
      return [];
    }

    if (children.length > 0 && children[0] === '$') {
      const single = this.parseComponent(children);
      return single ? [single] : [];
    }

    const results: (ParsedComponent | string)[] = [];

    for (const child of children) {
      if (typeof child === 'string') {
        results.push(child);
      } else if (Array.isArray(child)) {
        const parsed = this.parseComponent(child);
        if (parsed) {
          results.push(parsed);
        } else {
          // Handle nested arrays that aren't components
          const nestedChildren = this.parseChildren(child);
          results.push(...nestedChildren);
        }
      } else {
        // Handle objects or other types
        const childResults = this.parseComponentStructure([child]);
        results.push(...childResults);
      }
    }

    return results;
  }

  formatAsReadableJson(components: ParsedComponent[]): string {
    return JSON.stringify(components, null, 2);
  }

  formatAsReactComponents(components: ParsedComponent[]): string {
    return components.map(comp => this.componentToReactString(comp)).join('\n');
  }

  private componentToReactString(component: ParsedComponent, indent = 0): string {
    const spaces = '  '.repeat(indent);

    if (component.type === 'text') {
      return `${spaces}${JSON.stringify(component.props.content)}`;
    }

    const propStrings = Object.entries(component.props)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => {
        if (typeof value === 'string') {
          return `${key}="${value}"`;
        } else if (typeof value === 'object') {
          return `${key}={${JSON.stringify(value)}}`;
        } else {
          return `${key}={${value}}`;
        }
      });

    const propsString = propStrings.length > 0 ? ' ' + propStrings.join(' ') : '';

    if (!component.children || component.children.length === 0) {
      return `${spaces}<${component.component}${propsString} />`;
    }

    const childrenString = component.children
      .map(child => {
        if (typeof child === 'string') {
          return `${'  '.repeat(indent + 1)}${JSON.stringify(child)}`;
        }
        return this.componentToReactString(child, indent + 1);
      })
      .join('\n');

    return `${spaces}<${component.component}${propsString}>\n${childrenString}\n${spaces}</${component.component}>`;
  }

  private extractPushCalls(content: string): string[] {
    const calls: string[] = [];
    const pushToken = 'self.__next_f.push(';
    let searchIndex = 0;

    while (searchIndex < content.length) {
      const start = content.indexOf(pushToken, searchIndex);
      if (start === -1) {
        break;
      }

      let cursor = start + pushToken.length;
      while (cursor < content.length && /\s/.test(content[cursor])) {
        cursor++;
      }

      if (cursor >= content.length || content[cursor] !== '[') {
        searchIndex = cursor + 1;
        continue;
      }

      const arrayStart = cursor;
      const arrayEnd = this.findMatchingBracket(content, arrayStart);
      if (arrayEnd === -1) {
        searchIndex = arrayStart + 1;
        continue;
      }

      let afterArray = arrayEnd + 1;
      while (afterArray < content.length && /\s/.test(content[afterArray])) {
        afterArray++;
      }

      if (afterArray >= content.length || content[afterArray] !== ')') {
        searchIndex = afterArray;
        continue;
      }

      afterArray++;

      if (afterArray < content.length && content[afterArray] === ';') {
        afterArray++;
      }

      const snippet = content.slice(start, afterArray).trim();
      calls.push(snippet);
      searchIndex = afterArray;
    }

    return calls;
  }

  private findMatchingBracket(content: string, startIndex: number): number {
    let depth = 0;
    let inString = false;
    let stringChar: string | null = null;

    for (let i = startIndex; i < content.length; i++) {
      const char = content[i];

      if (inString) {
        if (char === '\\') {
          i++;
          continue;
        }

        if (char === stringChar) {
          inString = false;
          stringChar = null;
        }

        continue;
      }

      if (char === '"' || char === '\'' || char === '`') {
        inString = true;
        stringChar = char;
        continue;
      }

      if (char === '[') {
        depth++;
      } else if (char === ']') {
        depth--;

        if (depth === 0) {
          return i;
        }
      }
    }

    return -1;
  }
}
