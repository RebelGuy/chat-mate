SELECT
	info.name,
    COUNT(DISTINCT(livestreamId)) as livestreamCount,
    COUNT(*) as msgCount
FROM chat_mate.chat_message AS msg
LEFT JOIN chat_mate.channel AS channel ON msg.channelId = channel.id
LEFT JOIN (SELECT * FROM chat_mate.channel_info AS _info GROUP BY _info.channelId) AS info ON channel.id = info.channelId
GROUP BY channel.id
ORDER BY msgCount DESC
