import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
    },
    tls: {
        rejectUnauthorized: false
    }
})

export const sendPasswordResetEmail = async (email: string, token: string) => {
    const confirmLink = `${process.env.NEXTAUTH_URL}/auth/new-password?token=${token}`

    try {
        const info = await transporter.sendMail({
            from: '"GeldeSat Destek" <reset@geldesat.com>', // Değiştirebilirsiniz
            to: email,
            subject: "Şifre Sıfırlama İsteği",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #2563eb; padding: 20px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">GeldeSat</h1>
                    </div>
                    <div style="padding: 30px; background-color: #ffffff;">
                        <h2 style="color: #333333; margin-top: 0;">Şifre Sıfırlama İsteği</h2>
                        <p style="color: #666666; font-size: 16px; line-height: 1.5;">Merhaba,</p>
                        <p style="color: #666666; font-size: 16px; line-height: 1.5;">Hesabınız için bir şifre sıfırlama talebi aldık. Şifrenizi yenilemek için lütfen aşağıdaki butona tıklayın:</p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${confirmLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">Şifremi Sıfırla</a>
                        </div>
                        
                        <p style="color: #666666; font-size: 14px; line-height: 1.5;">Bu işlemi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz. Hesabınız güvende.</p>
                        
                        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;" />
                        
                        <p style="color: #999999; font-size: 12px; text-align: center;">
                            Eğer buton çalışmazsa, aşağıdaki bağlantıyı tarayıcınıza kopyalayıp yapıştırın:<br />
                            <a href="${confirmLink}" style="color: #2563eb;">${confirmLink}</a>
                        </p>
                    </div>
                </div>
            `
        })
        console.log("Email sent successfully: ", info.messageId)
    } catch (error) {
        console.error("Email sending failed:", error)
    }
}

export const sendVerificationEmail = async (email: string, token: string) => {
    const confirmLink = `${process.env.NEXTAUTH_URL}/auth/new-verification?token=${token}`

    try {
        const info = await transporter.sendMail({
            from: '"GeldeSat Destek" <verify@geldesat.com>',
            to: email,
            subject: "E-posta Adresinizi Doğrulayın",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #2563eb; padding: 20px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">GeldeSat</h1>
                    </div>
                    <div style="padding: 30px; background-color: #ffffff;">
                        <h2 style="color: #333333; margin-top: 0;">Hoş Geldiniz!</h2>
                        <p style="color: #666666; font-size: 16px; line-height: 1.5;">GeldeSat'a kayıt olduğunuz için teşekkür ederiz. Hesabınızı aktif hale getirmek için lütfen e-posta adresinizi doğrulayın.</p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${confirmLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">E-postamı Doğrula</a>
                        </div>
                        
                        <p style="color: #666666; font-size: 14px; line-height: 1.5;">Bu hesabı siz oluşturmadıysanız, bu e-postayı görmezden gelebilirsiniz.</p>
                        
                        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;" />
                        
                        <p style="color: #999999; font-size: 12px; text-align: center;">
                            Eğer buton çalışmazsa, aşağıdaki bağlantıyı tarayıcınıza kopyalayıp yapıştırın:<br />
                            <a href="${confirmLink}" style="color: #2563eb;">${confirmLink}</a>
                        </p>
                    </div>
                </div>
            `
        })
        console.log("Verification email sent successfully: ", info.messageId)
    } catch (error) {
        console.error("Verification email sending failed:", error)
    }
}
