/* ============================================================================
 * Copyright (c) Palo Alto Networks
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 * ========================================================================== */

import React from "react";

import CodeBlock from "@theme/CodeBlock";

import { useTypedDispatch, useTypedSelector } from "../../ApiItem/hooks";
import { clearResponse, clearStatus } from "./slice";

// TODO: We probably shouldn't attempt to format XML...
function formatXml(xml: string) {
  const tab = "  ";
  let formatted = "";
  let indent = "";

  xml.split(/>\s*</).forEach((node) => {
    if (node.match(/^\/\w/)) {
      // decrease indent by one 'tab'
      indent = indent.substring(tab.length);
    }
    formatted += indent + "<" + node + ">\r\n";
    if (node.match(/^<?\w[^>]*[^/]$/)) {
      // increase indent
      indent += tab;
    }
  });
  return formatted.substring(1, formatted.length - 3);
}

function Response() {
  const response = useTypedSelector((state) => state.response.value);
  const status = useTypedSelector((state) => state.response.status);
  const dispatch = useTypedDispatch();
  const responseStatusClass =
    status &&
    (parseInt(status) >= 400
      ? "response-summary__status-code--danger"
      : parseInt(status) >= 200 && parseInt(status) < 300
      ? "response-summary__status-code--success"
      : "response-summary__status-code--info");

  if (response === undefined) {
    return null;
  }

  let prettyResponse: string = response;
  try {
    prettyResponse = JSON.stringify(JSON.parse(response), null, 2);
  } catch {
    if (response.startsWith("<")) {
      prettyResponse = formatXml(response);
    }
  }

  return (
    <details className={`details__demo-panel`} open={true}>
      <summary>
        <div className={`details__response-summary`}>
          <h4>
            Response
            <br />
            {status && (
              <span className="response-summary__status-code">
                Status Code:{" "}
                <span className={responseStatusClass}>{`${status}`}</span>
              </span>
            )}
          </h4>
          <button
            className="button button--sm button--secondary"
            onClick={() => {
              dispatch(clearResponse());
              dispatch(clearStatus());
            }}
          >
            Clear
          </button>
        </div>
      </summary>
      <CodeBlock
        language={response.startsWith("<") ? `xml` : `json`}
        className="response-code-block"
      >
        {prettyResponse || "No Response"}
      </CodeBlock>
    </details>
  );
}

export default Response;
