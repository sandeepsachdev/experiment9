package com.raidonbungelingbay.service;

import com.raidonbungelingbay.model.HighScore;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.Collectors;

@Service
public class HighScoreService {

    private static final int MAX_ENTRIES = 10;
    private final List<HighScore> scores = new CopyOnWriteArrayList<>();

    public HighScoreService() {
        scores.add(new HighScore("ACE", 5000, 6));
        scores.add(new HighScore("MAV", 3000, 4));
        scores.add(new HighScore("ICE", 1500, 2));
    }

    public List<HighScore> top() {
        return scores.stream()
                .sorted(Comparator.comparingInt(HighScore::getScore).reversed())
                .limit(MAX_ENTRIES)
                .collect(Collectors.toList());
    }

    public List<HighScore> submit(HighScore score) {
        if (score.getName() == null || score.getName().isBlank()) {
            score.setName("???");
        }
        if (score.getName().length() > 12) {
            score.setName(score.getName().substring(0, 12));
        }
        if (score.getTimestamp() == null) {
            score.setTimestamp(java.time.Instant.now());
        }
        scores.add(score);
        return top();
    }
}
