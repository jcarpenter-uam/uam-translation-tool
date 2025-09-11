import rtms from "@zoom/rtms";

let clients = new Map();

rtms.onWebhookEvent(({ event, payload }) => {
  const streamId = payload?.rtms_stream_id;

  if (event == "meeting.rtms_stopped") {
    if (!streamId) {
      console.log(`Received meeting.rtms_stopped event without stream ID`);
      return;
    }

    const client = clients.get(streamId);
    if (!client) {
      console.log(
        `Received meeting.rtms_stopped event for unknown stream ID: ${streamId}`,
      );
      return;
    }

    client.leave();
    clients.delete(streamId);

    return;
  } else if (event !== "meeting.rtms_started") {
    console.log(`Ignoring unknown event`);
    return;
  }

  const client = new rtms.Client();
  clients.set(streamId, client);

  client.onTranscriptData((data, size, timestamp, metadata) => {
    console.log(`[${timestamp}] -- ${metadata.userName}: ${data}`);
  });

  client.onAudioData((data, size, timestamp, metadata) => {
    console.log(
      `Received ${size} bytes of audio data at ${timestamp} from ${metadata.userName}`,
    );
  });

  const video_params = {
    contentType: rtms.VideoContentType.RAW_VIDEO,
    codec: rtms.VideoCodec.H264,
    resolution: rtms.VideoResolution.SD,
    dataOpt: rtms.VideoDataOption.VIDEO_SINGLE_ACTIVE_STREAM,
    fps: 30,
  };

  client.setVideoParams(video_params);

  client.onVideoData((data, size, timestamp, metadata) => {
    console.log(
      `Received ${size} bytes of video data at ${timestamp} from ${metadata.userName}`,
    );
  });

  client.setDeskshareParams(video_params);

  client.onDeskshareData((data, size, timestamp, metadata) => {
    console.log(
      `Received ${size} bytes of deskshare data at ${timestamp} from ${metadata.userName}`,
    );
  });

  client.join(payload);
});

