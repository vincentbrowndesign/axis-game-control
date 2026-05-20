export type RoboflowTrainingUploadResult =
  | {
      status: "pending"
      response: null
    }
  | {
      status: "uploaded"
      response: unknown
    }
  | {
      status: "failed"
      response: unknown
    }

export async function uploadTrainingFrameToRoboflow({
  id,
  label,
  frame,
}: {
  id: string
  label: string
  frame: Blob
}): Promise<RoboflowTrainingUploadResult> {
  const apiKey = process.env.ROBOFLOW_API_KEY
  const workspace = process.env.ROBOFLOW_WORKSPACE
  const project = process.env.ROBOFLOW_PROJECT

  if (!apiKey || !workspace || !project) {
    return {
      status: "pending",
      response: null,
    }
  }

  const formData = new FormData()
  formData.append("file", frame, `${id}.jpg`)

  const roboflowUrl = new URL(`https://api.roboflow.com/dataset/${project}/upload`)
  roboflowUrl.searchParams.set("api_key", apiKey)
  roboflowUrl.searchParams.set("name", `${id}-${label}.jpg`)
  roboflowUrl.searchParams.set("split", "train")
  roboflowUrl.searchParams.set("batch", `axis-${workspace}`)

  const response = await fetch(roboflowUrl, {
    method: "POST",
    body: formData,
  })
  const text = await response.text()
  let payload: unknown = text

  try {
    payload = JSON.parse(text)
  } catch {
    payload = {
      response: text,
    }
  }

  return {
    status: response.ok ? "uploaded" : "failed",
    response: payload,
  }
}
