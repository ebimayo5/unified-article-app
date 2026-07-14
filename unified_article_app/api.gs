function uaCallGeminiJson_(promptText, maxOutputTokens, thinkingBudget) {
  const apiKey = uaGetGeminiApiKey_();

  if (!apiKey) {
    throw new Error('Gemini APIキーが設定されていません。');
  }

  const payload = {
    contents: [
      {
        parts: [
          { text: promptText }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.72,
      topP: 0.92,
      maxOutputTokens: maxOutputTokens,
      thinkingConfig: {
        thinkingBudget: thinkingBudget
      }
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  let lastErrorMessage = '';

  for (const model of UA_GEMINI_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const url = 'https://generativelanguage.googleapis.com/v1beta/' + model + ':generateContent?key=' + apiKey;
      const response = UrlFetchApp.fetch(url, options);
      const statusCode = response.getResponseCode();
      const responseText = response.getContentText();
      let json;

      try {
        json = JSON.parse(responseText);
      } catch (e) {
        lastErrorMessage = responseText;
        if (attempt < 2) {
          Utilities.sleep(4000);
          continue;
        }
        break;
      }

      if (statusCode !== 200) {
        lastErrorMessage = json.error && json.error.message
          ? json.error.message
          : responseText;

        if ((uaIsTemporaryApiError_(lastErrorMessage) || statusCode === 429 || statusCode === 503) && attempt < 2) {
          Utilities.sleep(4000);
          continue;
        }

        if (uaIsTemporaryApiError_(lastErrorMessage) || statusCode === 429 || statusCode === 503) {
          break;
        }

        throw new Error('Gemini APIエラー: ' + lastErrorMessage);
      }

      const text = json.candidates &&
        json.candidates[0] &&
        json.candidates[0].content &&
        json.candidates[0].content.parts &&
        json.candidates[0].content.parts[0] &&
        json.candidates[0].content.parts[0].text;

      if (!text) {
        lastErrorMessage = 'Geminiから本文が返りませんでした。';
        if (attempt < 2) {
          Utilities.sleep(4000);
          continue;
        }
        break;
      }

      return {
        data: JSON.parse(uaStripJsonFence_(text)),
        model: model
      };
    }
  }

  throw new Error('Gemini APIが混雑しています。最後のエラー: ' + lastErrorMessage);
}

function uaCallOpenAiJson_(promptText, maxOutputTokens) {
  const apiKey = uaGetOpenAiApiKey_();

  if (!apiKey) {
    throw new Error('OpenAI APIキーが設定されていません。');
  }

  const model = uaGetOpenAiModel_();
  const payload = {
    model: model,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: promptText
          }
        ]
      }
    ],
    text: {
      format: {
        type: 'json_object'
      }
    },
    max_output_tokens: maxOutputTokens
  };

  const response = UrlFetchApp.fetch('https://api.openai.com/v1/responses', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + apiKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const statusCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error('OpenAI APIエラー: ' + responseText);
  }

  const json = JSON.parse(responseText);
  const text = uaExtractOpenAiText_(json);

  if (!text) {
    throw new Error('OpenAIから本文が返りませんでした。');
  }

  return {
    data: JSON.parse(uaStripJsonFence_(text)),
    model: model
  };
}

function uaCallOpenAiImage_(promptText, options) {
  const apiKey = uaGetOpenAiApiKey_();

  if (!apiKey) {
    throw new Error('OpenAI APIキーが設定されていません。');
  }

  const model = uaGetOpenAiImageModel_();
  const payload = {
    model: model,
    prompt: promptText,
    n: 1,
    size: options && options.size ? options.size : '1536x1024',
    quality: options && options.quality ? options.quality : 'high'
  };

  const response = UrlFetchApp.fetch('https://api.openai.com/v1/images/generations', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + apiKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const statusCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error('OpenAI Images APIエラー: ' + responseText);
  }

  const json = JSON.parse(responseText);
  const first = json.data && json.data[0];
  if (!first) {
    throw new Error('OpenAI Images APIから画像データが返りませんでした。');
  }

  if (first.b64_json) {
    return {
      bytes: Utilities.base64Decode(first.b64_json),
      contentType: 'image/png',
      model: model
    };
  }

  if (first.url) {
    const imageRes = UrlFetchApp.fetch(first.url, {
      muteHttpExceptions: true,
      followRedirects: true
    });
    const imageStatus = imageRes.getResponseCode();
    if (imageStatus < 200 || imageStatus >= 300) {
      throw new Error('OpenAI Images APIの画像URLを取得できませんでした。HTTP ' + imageStatus);
    }
    const headers = imageRes.getHeaders();
    const contentType = String(headers['Content-Type'] || headers['content-type'] || 'image/png').split(';')[0].trim();
    return {
      bytes: imageRes.getBlob().getBytes(),
      contentType: contentType,
      model: model
    };
  }

  throw new Error('OpenAI Images APIのレスポンスに画像が含まれていません。');
}


function uaCallGeminiImage_(promptText, options) {
  const apiKey = uaGetGeminiApiKey_();

  if (!apiKey) {
    throw new Error('Gemini API key is not configured.');
  }

  const model = uaGetGeminiImageModel_();
  const payload = {
    contents: [
      {
        parts: [
          { text: promptText }
        ]
      }
    ],
    generationConfig: {
      responseModalities: ['IMAGE'],
      temperature: 0.86
    }
  };

  const response = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/' + model + ':generateContent?key=' + apiKey, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const statusCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error('Gemini Images API error: ' + responseText);
  }

  const json = JSON.parse(responseText);
  const imagePart = uaExtractGeminiImagePart_(json);

  if (!imagePart || !imagePart.data) {
    throw new Error('Gemini Images API did not return image data.');
  }

  return {
    bytes: Utilities.base64Decode(imagePart.data),
    contentType: imagePart.mimeType || 'image/png',
    model: model
  };
}

function uaExtractGeminiImagePart_(json) {
  const candidates = json && json.candidates || [];
  for (let i = 0; i < candidates.length; i++) {
    const parts = candidates[i] &&
      candidates[i].content &&
      candidates[i].content.parts || [];
    for (let j = 0; j < parts.length; j++) {
      const inlineData = parts[j].inlineData || parts[j].inline_data;
      if (inlineData && inlineData.data) {
        return {
          data: inlineData.data,
          mimeType: inlineData.mimeType || inlineData.mime_type || 'image/png'
        };
      }
    }
  }

  const outputImage = json && json.output_image;
  if (outputImage && outputImage.data) {
    return {
      data: outputImage.data,
      mimeType: outputImage.mime_type || outputImage.mimeType || 'image/png'
    };
  }

  return null;
}
function uaCallClaudeJson_(promptText, maxOutputTokens) {
  const apiKey = uaGetClaudeApiKey_();

  if (!apiKey) {
    throw new Error('Claude APIキーが設定されていません。');
  }

  const model = uaGetClaudeModel_();
  const payload = {
    model: model,
    max_tokens: maxOutputTokens,
    temperature: 0.72,
    messages: [
      {
        role: 'user',
        content: promptText
      }
    ]
  };

  const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const statusCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error('Claude APIエラー: ' + responseText);
  }

  const json = JSON.parse(responseText);
  const text = json.content &&
    json.content[0] &&
    json.content[0].text;

  if (!text) {
    throw new Error('Claudeから本文が返りませんでした。');
  }

  return {
    data: JSON.parse(uaStripJsonFence_(text)),
    model: model
  };
}

function uaCallReaderMindJson_(promptText, provider) {
  if (provider === 'openai') {
    return uaCallOpenAiJson_(promptText, 7000);
  }

  return uaCallGeminiJson_(promptText, 7000, 384);
}

function uaExtractOpenAiText_(json) {
  if (json.output_text) {
    return json.output_text;
  }

  const output = json.output || [];

  for (let i = 0; i < output.length; i++) {
    const content = output[i].content || [];
    for (let j = 0; j < content.length; j++) {
      if (content[j].text) {
        return content[j].text;
      }
    }
  }

  return '';
}

function uaIsTemporaryApiError_(message) {
  const text = String(message || '').toLowerCase();
  return text.indexOf('high demand') !== -1 ||
    text.indexOf('quota') !== -1 ||
    text.indexOf('rate') !== -1 ||
    text.indexOf('resource has been exhausted') !== -1 ||
    text.indexOf('503') !== -1 ||
    text.indexOf('429') !== -1;
}
