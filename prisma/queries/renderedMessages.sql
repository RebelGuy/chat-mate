SELECT msg.id AS `Msg Id`, CONVERT_TZ(msg.time, '+00:00', '+10:00') AS Time, groupedInfo.name AS `Channel Name`, txt.concatted AS `Full Message`
FROM chat_mate.chat_message AS msg
LEFT JOIN (
	# this gets the full rendered chat message
	SELECT text, label, chatMessageId, group_concat(coalesce(text, label) SEPARATOR ' ') AS concatted # https://stackoverflow.com/a/13451984
	FROM chat_mate.chat_message_part AS part
	LEFT JOIN chat_mate.chat_text AS text ON part.textId = text.id
	LEFT JOIN chat_mate.chat_emoji AS emoji ON part.emojiId = emoji.id
	GROUP BY chatMessageId
) AS txt ON txt.chatMessageId = msg.id
LEFT JOIN (
	# use most recent channel info. to do this, get first the latest info for each channel
    # then re-join the channel info column
    # https://stackoverflow.com/questions/1066453/mysql-group-by-and-order-by
    # sepcifically https://stackoverflow.com/a/35456144
	SELECT * FROM (
		SELECT channelId, MAX(time) AS time FROM chat_mate.channel_info AS _info
        GROUP BY channelId
    ) AS filteredInfo JOIN chat_mate.channel_info USING (channelId, time) # join the record that matches both columns
) AS groupedInfo ON groupedInfo.channelId = msg.channelId
ORDER BY time DESC