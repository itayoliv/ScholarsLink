import { useCallback, useEffect, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { MySQL, sql } from '@codemirror/lang-sql';
import { EditorView } from '@codemirror/view';
import './App.css';

async function apiRequest(path, options) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Request failed.');
  }
  return data;
}

function App() {
  const [schema, setSchema] = useState({ database: '', tables: [], procedures: [] });
  const [sqlText, setSqlText] = useState('SELECT * FROM User LIMIT 20;');
  const [selection, setSelection] = useState({ from: 0, to: 0, text: '' });
  const [outputs, setOutputs] = useState([]);
  const [status, setStatus] = useState('Ready.');
  const [loading, setLoading] = useState(false);
  const [activeItem, setActiveItem] = useState(null);
  const [activeProcedure, setActiveProcedure] = useState(null);
  const editorViewRef = useRef(null);
  const sqlTextRef = useRef(sqlText);
  const selectionRef = useRef(selection);

  useEffect(() => {
    sqlTextRef.current = sqlText;
  }, [sqlText]);

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  const loadSchema = useCallback(async () => {
    try {
      const data = await apiRequest('/api/schema');
      setSchema(data);
      setStatus(`Connected to ${data.database}.`);
    } catch (error) {
      setStatus(`Schema load failed: ${error.message}`);
    }
  }, []);

  useEffect(() => {
    loadSchema();
  }, [loadSchema]);

  const runSql = useCallback(async (rawSql, label = 'Query') => {
    const sqlToRun = (rawSql || '').trim();
    if (!sqlToRun) {
      setStatus('Nothing to run. Select text or write a query.');
      return;
    }

    setLoading(true);
    setStatus(`Running ${label}...`);

    try {
      const data = await apiRequest('/api/query', {
        method: 'POST',
        body: JSON.stringify({ sql: sqlToRun }),
      });
      setOutputs(data.outputs || []);
      setStatus(`${label} finished.`);

      // Reload table/column tree after schema-changing statements.
      if (/\b(alter|create|drop|rename|truncate)\b/i.test(sqlToRun)) {
        await loadSchema();
      }
    } catch (error) {
      setOutputs([{ type: 'error', message: error.message }]);
      setStatus(`${label} failed.`);
    } finally {
      setLoading(false);
    }
  }, [loadSchema]);

  const runSelectionOrAll = useCallback(() => {
    const currentSelection = selectionRef.current;
    const selected = (currentSelection.text || '').trim();
    const fallback = sqlTextRef.current;
    runSql(selected || fallback, selected ? 'selection' : 'editor');
  }, [runSql]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'F5') {
        event.preventDefault();
        runSelectionOrAll();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [runSelectionOrAll]);

  async function openTable(tableName) {
    setActiveItem({ type: 'table', name: tableName });
    setActiveProcedure(null);
    setLoading(true);
    setStatus(`Loading top 500 rows from ${tableName}...`);

    try {
      const data = await apiRequest(`/api/tables/${encodeURIComponent(tableName)}/rows`);
      setOutputs([data]);
      setStatus(`Showing top ${data.rows?.length || 0} rows from ${tableName}.`);
    } catch (error) {
      setOutputs([{ type: 'error', message: error.message }]);
      setStatus(`Failed to load table ${tableName}.`);
    } finally {
      setLoading(false);
    }
  }

  function tableName(table) {
    return typeof table === 'string' ? table : table.name;
  }

  async function openProcedure(procedureName) {
    setActiveItem({ type: 'procedure', name: procedureName });
    setLoading(true);
    setStatus(`Loading procedure ${procedureName}...`);

    try {
      const data = await apiRequest(`/api/procedures/${encodeURIComponent(procedureName)}`);
      setSqlText(data.definition || '');
      setActiveProcedure(procedureName);
      setOutputs([]);
      setStatus(`Loaded procedure ${procedureName}. Edit and save to update.`);
    } catch (error) {
      setOutputs([{ type: 'error', message: error.message }]);
      setStatus(`Failed to load procedure ${procedureName}.`);
    } finally {
      setLoading(false);
    }
  }

  async function saveProcedure() {
    if (!activeProcedure) {
      setStatus('Open a procedure first, or run CREATE PROCEDURE SQL manually.');
      return;
    }

    const body = sqlTextRef.current.trim();
    if (!body) {
      setStatus('Procedure body is empty.');
      return;
    }

    const sql = `DROP PROCEDURE IF EXISTS \`${activeProcedure}\`;\n${body}`;
    await runSql(sql, `save procedure ${activeProcedure}`);
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div>
            <p className="eyebrow">SQL Editor</p>
            <h1>{schema.database || 'database'}</h1>
          </div>
          <button type="button" className="ghost" onClick={loadSchema} disabled={loading}>
            Refresh
          </button>
        </div>

        <section>
          <h2>Tables</h2>
          <ul>
            {schema.tables.length === 0 ? <li className="muted">No tables</li> : null}
            {schema.tables.map((table) => {
              const name = tableName(table);
              const columns = Array.isArray(table.columns) ? table.columns : [];

              return (
              <li key={name}>
                <button
                  type="button"
                  className={activeItem?.type === 'table' && activeItem.name === name ? 'active' : ''}
                  onClick={() => openTable(name)}
                >
                  {name}
                </button>
                {columns.length > 0 ? (
                  <ul className="column-list">
                    {columns.map((column) => (
                      <li key={column.name}>
                        <span>{column.name}</span>
                        <small>{column.type}{column.nullable ? '' : ' required'}</small>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h2>Procedures</h2>
          <ul>
            {schema.procedures.length === 0 ? <li className="muted">No procedures</li> : null}
            {schema.procedures.map((procedure) => (
              <li key={procedure}>
                <button
                  type="button"
                  className={activeItem?.type === 'procedure' && activeItem.name === procedure ? 'active' : ''}
                  onClick={() => openProcedure(procedure)}
                >
                  {procedure}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </aside>

      <main className="workspace">
        <section className="output-pane">
          <div className="output-header">
            <strong>Output</strong>
            <span className="status">{status}</span>
          </div>
          <Results outputs={outputs} />
        </section>

        <header className="toolbar">
          <div>
            <strong>Query editor</strong>
            <span className="muted"> Run selection with the button or F5. Empty selection runs all.</span>
          </div>
          <div className="toolbar-actions">
            {activeProcedure ? (
              <button type="button" className="secondary" onClick={saveProcedure} disabled={loading}>
                Save procedure
              </button>
            ) : null}
            <button type="button" onClick={runSelectionOrAll} disabled={loading}>
              {loading ? 'Running...' : 'Run'}
            </button>
          </div>
        </header>

        <div className="editor-pane">
          <CodeMirror
            value={sqlText}
            height="100%"
            theme="dark"
            extensions={[
              sql({ dialect: MySQL }),
              EditorView.lineWrapping,
            ]}
            onChange={(value) => setSqlText(value)}
            onCreateEditor={(view) => {
              editorViewRef.current = view;
            }}
            onUpdate={(viewUpdate) => {
              if (!viewUpdate.selectionSet && !viewUpdate.docChanged) return;
              const range = viewUpdate.state.selection.main;
              const text = viewUpdate.state.sliceDoc(range.from, range.to);
              setSelection({ from: range.from, to: range.to, text });
            }}
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLine: true,
            }}
          />
        </div>
      </main>
    </div>
  );
}

function Results({ outputs }) {
  if (!outputs || outputs.length === 0) {
    return <p className="muted empty">Results will appear here.</p>;
  }

  return (
    <div className="results">
      {outputs.map((output, index) => {
        if (output.type === 'error') {
          return (
            <div className="result-card error" key={`error-${index}`}>
              <strong>Error</strong>
              <pre>{output.message}</pre>
            </div>
          );
        }

        if (output.type === 'ok') {
          return (
            <div className="result-card" key={`ok-${index}`}>
              <strong>OK</strong>
              <p>{output.message}</p>
              <p className="muted">Affected rows: {output.affectedRows}</p>
            </div>
          );
        }

        return (
          <div className="result-card" key={`grid-${index}`}>
            <div className="grid-meta">
              <strong>Result set {index + 1}</strong>
              <span className="muted">{output.rows?.length || 0} row(s)</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {(output.columns || []).map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(output.rows || []).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex}>{cell === null ? <em>NULL</em> : String(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default App;
