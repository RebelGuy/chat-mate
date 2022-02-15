SELECT 
	stream.createdAt,
    stream.liveId,
    (TIME_TO_SEC(TIMEDIFF(stream.end, stream.start)) / 60) as durationMin,
    COUNT(msg.id) as msgCount, COUNT(DISTINCT(msg.channelId)) as uniqueAuthors,
    COUNT(msg.id)/(TIME_TO_SEC(TIMEDIFF(stream.end, stream.start)) / 60) as msgPerMin
    
	FROM chat_mate.chat_message as msg
	LEFT JOIN chat_mate.livestream as stream on stream.id = msg.livestreamId
	GROUP BY msg.livestreamId
	ORDER BY stream.createdAt DESC;