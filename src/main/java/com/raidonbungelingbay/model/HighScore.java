package com.raidonbungelingbay.model;

import java.time.Instant;

public class HighScore {
    private String name;
    private int score;
    private int factoriesDestroyed;
    private Instant timestamp;

    public HighScore() {}

    public HighScore(String name, int score, int factoriesDestroyed) {
        this.name = name;
        this.score = score;
        this.factoriesDestroyed = factoriesDestroyed;
        this.timestamp = Instant.now();
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public int getScore() { return score; }
    public void setScore(int score) { this.score = score; }

    public int getFactoriesDestroyed() { return factoriesDestroyed; }
    public void setFactoriesDestroyed(int factoriesDestroyed) { this.factoriesDestroyed = factoriesDestroyed; }

    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }
}
