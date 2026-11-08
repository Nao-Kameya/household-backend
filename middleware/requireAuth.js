const firebaseAuth = require("../firebaseAdmin");

async function requireAuth(req, res, next) {
    const authorization = req.get("Authorization");
    const match = authorization?.match(/^Bearer\s+(\S+)$/i);

    if(!match) {
        return res.status(401).json({
            message: "ログインが必要です"
        });
    }

    const idToken = match[1];

    let decodedToken;

    try {
        decodedToken = await firebaseAuth.verifyIdToken(idToken);
    } catch (error) {
        console.error("認証の検証に失敗:", error.code);

        return res.status(401).json({
            message: "認証を確認できませんでした。再度ログインしてください",
        });
    }

    req.user = {
        uid: decodedToken.uid,
    };

    next();
}

    module.exports = requireAuth;