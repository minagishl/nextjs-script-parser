import { useState } from 'preact/hooks';
import { CheckCircle2, XCircle } from 'lucide-preact';
import { NextJSScriptParser } from './parser';

export function App() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [outputFormat, setOutputFormat] = useState<'json' | 'react'>('json');
  const [parseStatus, setParseStatus] = useState<
    'idle' | 'parsing' | 'success' | 'error'
  >('idle');
  const [parseInfo, setParseInfo] = useState<string>('');

  const parser = new NextJSScriptParser();

  const handleParse = () => {
    setParseStatus('parsing');
    setParseInfo('Parsing...');

    try {
      const aggregate = parser.parseDocumentContent(input);

      if (aggregate.totalScripts === 0) {
        setParseStatus('error');
        setParseInfo(
          'No self.__next_f.push(...) calls found in the provided input.'
        );
        setOutput(
          'No Next.js script payloads detected. Paste the contents of <head> or relevant script tags.'
        );
        return;
      }

      const failureDetails = aggregate.results
        .filter((result) => !result.success)
        .map((result) => {
          const reason = result.error || 'Unknown error';
          const typeHint =
            result.dataType === 'module-loading'
              ? ' (module-loading payload)'
              : '';
          return `#${result.index + 1}: ${reason}${typeHint}\n   Snippet: ${
            result.snippetPreview
          }`;
        })
        .join('\n\n');

      const moduleSummary =
        aggregate.moduleLoadingCount > 0
          ? ` ${aggregate.moduleLoadingCount} call(s) contained module/chunk metadata and were skipped.`
          : '';

      if (aggregate.successCount > 0) {
        setParseStatus('success');
        const summary = `Parsed ${aggregate.successCount} / ${aggregate.totalScripts} self.__next_f.push call(s). Extracted ${aggregate.combinedComponents.length} component node(s).`;
        const warning =
          aggregate.failureCount > 0
            ? ` ${aggregate.failureCount} call(s) could not be parsed.`
            : '';
        setParseInfo(summary + warning + moduleSummary);

        const baseOutput =
          outputFormat === 'json'
            ? parser.formatAsReadableJson(aggregate.combinedComponents)
            : parser.formatAsReactComponents(aggregate.combinedComponents);

        if (aggregate.failureCount > 0) {
          setOutput(`${baseOutput}\n\nFailures:\n${failureDetails}`);
        } else {
          setOutput(baseOutput);
        }

        return;
      }

      if (aggregate.moduleLoadingCount > 0 && aggregate.failureCount === 0) {
        setParseStatus('success');
        setParseInfo(
          `Detected ${aggregate.moduleLoadingCount} module/chunk payload(s); no React component data found.`
        );
        setOutput(
          'All detected payloads were module/chunk metadata (no components to render).'
        );
        return;
      }

      setParseStatus('error');
      setParseInfo(
        'Unable to parse any self.__next_f.push call from the input.'
      );
      const fallback = [failureDetails, moduleSummary.trim()]
        .filter(Boolean)
        .join('\n\n');
      setOutput(
        fallback || 'All detected script payloads were non-component data.'
      );
    } catch (error) {
      setParseStatus('error');
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      setParseInfo(`Unexpected error: ${errorMessage}`);
      setOutput(`Unexpected Error: ${errorMessage}`);
    }
  };

  const handleClear = () => {
    setInput('');
    setOutput('');
    setParseStatus('idle');
    setParseInfo('');
  };

  const handleDownload = () => {
    if (!output) return;
    const extension = outputFormat === 'json' ? 'json' : 'tsx';
    const mimeType =
      outputFormat === 'json' ? 'application/json' : 'text/plain';
    const now = new Date();
    const pad = (value: number) => value.toString().padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
      now.getDate()
    )}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const blob = new Blob([output], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nextjs-script-parser-${timestamp}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const sampleInput = `self.__next_f.push([1, "4c:\\"$Sreact.suspense\\"\\n"])`;

  return (
    <div class="min-h-screen bg-gray-50 p-4">
      <div class="max-w-6xl mx-auto">
        <header class="mb-8">
          <h1 class="text-3xl font-bold text-gray-900 mb-2">
            Next.js Script Parser
          </h1>
          <p class="text-gray-600">
            A tool to parse and convert data from Next.js &lt;script&gt;
            elements
          </p>
        </header>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="space-y-4">
            <div class="flex justify-between items-center">
              <h2 class="text-xl font-semibold text-gray-800">Input</h2>
              <button
                onClick={() => setInput(sampleInput)}
                class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              >
                Use Sample
              </button>
            </div>

            <textarea
              value={input}
              onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)}
              placeholder="Paste the content of Next.js script element here..."
              class="w-full h-64 p-3 border border-gray-300 rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            <div class="flex gap-2">
              <button
                onClick={handleParse}
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Parse
              </button>
              <button
                onClick={handleClear}
                class="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          <div class="space-y-4">
            <div class="flex justify-between items-center">
              <h2 class="text-xl font-semibold text-gray-800">Output</h2>
              <div class="flex gap-2">
                <button
                  onClick={() => setOutputFormat('json')}
                  class={`px-3 py-1 text-sm rounded transition-colors ${
                    outputFormat === 'json'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  JSON
                </button>
                <button
                  onClick={() => setOutputFormat('react')}
                  class={`px-3 py-1 text-sm rounded transition-colors ${
                    outputFormat === 'react'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  React
                </button>
              </div>
            </div>

            {parseInfo && (
              <div
                class={`p-3 rounded-lg text-sm ${
                  parseStatus === 'success'
                    ? 'bg-green-100 text-green-800 border border-green-200'
                    : parseStatus === 'error'
                    ? 'bg-red-100 text-red-800 border border-red-200'
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                }`}
              >
                <div class="flex items-center gap-2">
                  {parseStatus === 'parsing' && (
                    <div class="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  )}
                  {parseStatus === 'success' && (
                    <CheckCircle2
                      class="h-5 w-5 text-green-600"
                      aria-hidden="true"
                    />
                  )}
                  {parseStatus === 'error' && (
                    <XCircle class="h-5 w-5 text-red-600" aria-hidden="true" />
                  )}
                  <span>{parseInfo}</span>
                </div>
              </div>
            )}

            <textarea
              value={output}
              readOnly
              class="w-full h-64 p-3 border border-gray-300 rounded-lg font-mono text-sm resize-none bg-gray-50"
              placeholder="Parse results will be displayed here..."
            />

            {output && (
              <div class="flex flex-wrap gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(output)}
                  class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Copy to Clipboard
                </button>
                <button
                  onClick={handleDownload}
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Download File
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
