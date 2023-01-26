# gets the ordered total experience for the given users
SELECT userId, SUM(delta) AS xp
FROM experience_transaction
WHERE userId IN (1, 2, 12)
GROUP BY userId
ORDER BY xp DESC
;

# gets the ordered total experience (using the snapshots) for the given users
SELECT User.id AS userId, (COALESCE(SUM(TxsAfterSnap.xp), 0) + COALESCE(Snapshot.experience, 0)) AS experience
FROM experience_snapshot AS Snapshot
# not all users are guaranteed to have snapshots - we generate a null-row by right joining the users table
RIGHT JOIN chat_user User ON User.id = Snapshot.userId
# after the join, the new right entries might be null, meaning that a user hasn't had experience transacted since the snapshot on the left
LEFT JOIN (
	# this selects the total xp since the snapshot for each user that had experience transacted since the snapshot.
	# if no snapshot exists, gets the total xp since the beginning of time
	SELECT tx.userId, SUM(delta) AS xp
	FROM experience_transaction AS tx
    LEFT JOIN experience_snapshot AS InnerSnapshot ON InnerSnapshot.userId = tx.userId
	WHERE tx.time > COALESCE(InnerSnapshot.time, 0)
	GROUP BY tx.userId
) AS TxsAfterSnap ON TxsAfterSnap.userId = User.Id
WHERE User.id IN (1, 2, 12)
# grouping required because of the aggregation 'SUM()' in the selection
GROUP BY User.id, Snapshot.experience
ORDER BY experience DESC;


SELECT *
FROM experience_snapshot S
RIGHT JOIN chat_user U on U.id = S.userId
WHERE U.id IN (1, 2, 12)
;

# returns youtube channels and their latest channel infos for the given users
SELECT YoutubeChannel.youtubeId, YoutubeChannel.userId, LatestYoutubeInfo.name, LatestYoutubeInfo.imageUrl, LatestYoutubeInfo.isOwner, LatestYoutubeInfo.isModerator, LatestYoutubeInfo.isVerified, LatestYoutubeInfo.time
FROM youtube_channel AS YoutubeChannel
LEFT JOIN (
	SELECT YoutubeInfo.*
    FROM youtube_channel_info AS YoutubeInfo
    WHERE (YoutubeInfo.channelId, YoutubeInfo.time) IN (
		# for each channel, select the time of the most recent update
		SELECT channelId, MAX(time) AS latest
        FROM youtube_channel_info AS InnerYoutubeInfo
		GROUP BY InnerYoutubeInfo.channelId
    )
) AS LatestYoutubeInfo ON YoutubeChannel.id = LatestYoutubeInfo.channelId
WHERE userId IN (1, 2, 12)
;

# selects the latest chat message of the given users (used for `getActiveUserChannel`)
SELECT * FROM chat_message
WHERE (userId, time) IN (
    SELECT userId, MAX(time)
    FROM chat_message
    GROUP BY userId
) AND userId IN (1, 2, 12)
;
